#include <napi.h>
#include <ldap.h>
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <cstring>

namespace {

struct Handle {
  LDAP* ld = nullptr;
  std::string url;
};

std::map<uint32_t, std::shared_ptr<Handle>> g_handles;
uint32_t g_nextId = 1;

Napi::Error MakeLdapError(Napi::Env env, int code, const std::string& msg) {
  Napi::Error err = Napi::Error::New(env, msg + ": " + ldap_err2string(code));
  err.Set("code", Napi::Number::New(env, code));
  return err;
}

std::shared_ptr<Handle> GetHandle(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (!info[0].IsObject()) {
    throw Napi::TypeError::New(env, "handle object required");
  }
  auto obj = info[0].As<Napi::Object>();
  uint32_t id = obj.Get("id").As<Napi::Number>().Uint32Value();
  auto it = g_handles.find(id);
  if (it == g_handles.end()) {
    throw Napi::Error::New(env, "invalid handle");
  }
  return it->second;
}

Napi::Value Connect(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto options = info[0].As<Napi::Object>();
  std::string url = options.Get("url").As<Napi::String>().Utf8Value();

  LDAP* ld = nullptr;
  int rc = ldap_initialize(&ld, url.c_str());
  if (rc != LDAP_SUCCESS || ld == nullptr) {
    throw MakeLdapError(env, rc, "ldap_initialize failed");
  }

  int version = LDAP_VERSION3;
  ldap_set_option(ld, LDAP_OPT_PROTOCOL_VERSION, &version);

  if (options.Has("timeout") && options.Get("timeout").IsNumber()) {
    struct timeval tv{};
    tv.tv_sec = static_cast<long>(options.Get("timeout").As<Napi::Number>().Int64Value() / 1000);
    tv.tv_usec = static_cast<long>((options.Get("timeout").As<Napi::Number>().Int64Value() % 1000) * 1000);
    ldap_set_option(ld, LDAP_OPT_TIMEOUT, &tv);
  }

  if (options.Has("connectTimeout") && options.Get("connectTimeout").IsNumber()) {
    struct timeval tv{};
    tv.tv_sec = static_cast<long>(options.Get("connectTimeout").As<Napi::Number>().Int64Value() / 1000);
    tv.tv_usec = static_cast<long>((options.Get("connectTimeout").As<Napi::Number>().Int64Value() % 1000) * 1000);
    ldap_set_option(ld, LDAP_OPT_NETWORK_TIMEOUT, &tv);
  }

  auto handle = std::make_shared<Handle>();
  handle->ld = ld;
  handle->url = url;

  uint32_t id = g_nextId++;
  g_handles[id] = handle;

  Napi::Object result = Napi::Object::New(env);
  result.Set("id", Napi::Number::New(env, id));
  return result;
}

Napi::Value StartTLS(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  if (info.Length() > 1 && info[1].IsObject()) {
    auto options = info[1].As<Napi::Object>();
    if (options.Has("caFile") && options.Get("caFile").IsString()) {
      std::string caFile = options.Get("caFile").As<Napi::String>().Utf8Value();
      ldap_set_option(nullptr, LDAP_OPT_X_TLS_CACERTFILE, caFile.c_str());
    }
  }
  int rc = ldap_start_tls_s(handle->ld, nullptr, nullptr);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_start_tls_s failed");
  }
  return env.Undefined();
}

Napi::Value BindSimple(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  std::string password = payload.Get("password").As<Napi::String>().Utf8Value();

  struct berval cred;
  cred.bv_val = const_cast<char*>(password.c_str());
  cred.bv_len = password.size();

  int rc = ldap_sasl_bind_s(handle->ld, dn.c_str(), LDAP_SASL_SIMPLE, &cred, nullptr, nullptr, nullptr);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "simple bind failed");
  }
  return env.Undefined();
}

Napi::Value BindSasl(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string mechanism = payload.Get("mechanism").As<Napi::String>().Utf8Value();

  const char* mech = mechanism.c_str();
  struct berval* servercredp = nullptr;
  struct berval cred;
  struct berval* credPtr = nullptr;
  std::string credStorage;

  if (payload.Has("credential") && !payload.Get("credential").IsNull() && !payload.Get("credential").IsUndefined()) {
    if (payload.Get("credential").IsString()) {
      credStorage = payload.Get("credential").As<Napi::String>().Utf8Value();
      cred.bv_val = credStorage.data();
      cred.bv_len = credStorage.size();
      credPtr = &cred;
    }
  }

  int rc = ldap_sasl_bind_s(handle->ld, nullptr, mech, credPtr, nullptr, nullptr, &servercredp);
  if (servercredp != nullptr) {
    ber_bvfree(servercredp);
  }

  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "SASL bind failed");
  }
  return env.Undefined();
}

std::vector<char*> BuildAttributeArray(const Napi::Value& value) {
  std::vector<char*> attrs;
  if (!value.IsArray()) {
    attrs.push_back(nullptr);
    return attrs;
  }
  auto array = value.As<Napi::Array>();
  attrs.reserve(array.Length() + 1);
  for (uint32_t i = 0; i < array.Length(); ++i) {
    std::string attr = array.Get(i).As<Napi::String>().Utf8Value();
    char* dup = static_cast<char*>(std::malloc(attr.size() + 1));
    std::memcpy(dup, attr.c_str(), attr.size() + 1);
    attrs.push_back(dup);
  }
  attrs.push_back(nullptr);
  return attrs;
}

void FreeAttributeArray(std::vector<char*>& attrs) {
  for (char* ptr : attrs) {
    if (ptr) std::free(ptr);
  }
}

int ScopeFromString(const std::string& scope) {
  if (scope == "base") return LDAP_SCOPE_BASE;
  if (scope == "one") return LDAP_SCOPE_ONELEVEL;
  if (scope == "sub") return LDAP_SCOPE_SUBTREE;
  return LDAP_SCOPE_SUBTREE;
}

Napi::Value Search(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string baseDN = payload.Get("baseDN").As<Napi::String>().Utf8Value();
  auto options = payload.Get("options").As<Napi::Object>();
  std::string filter = options.Get("filter").As<Napi::String>().Utf8Value();
  std::string scope = options.Get("scope").As<Napi::String>().Utf8Value();
  int sizeLimit = options.Has("sizeLimit") ? options.Get("sizeLimit").As<Napi::Number>().Int32Value() : 0;
  int timeLimit = options.Has("timeLimit") ? options.Get("timeLimit").As<Napi::Number>().Int32Value() : 0;

  auto attrs = BuildAttributeArray(options.Get("attributes"));

  LDAPMessage* result = nullptr;
  struct timeval timeout{};
  timeout.tv_sec = timeLimit > 0 ? timeLimit : 0;
  timeout.tv_usec = 0;

  BerElement* serverctrls = nullptr;
  if (options.Has("paged") && options.Get("paged").IsObject()) {
    auto paged = options.Get("paged").As<Napi::Object>();
    int pageSize = paged.Get("pageSize").As<Napi::Number>().Int32Value();
    struct berval cookie{};
    if (paged.Has("cookie") && paged.Get("cookie").IsBuffer()) {
      auto cookieBuf = paged.Get("cookie").As<Napi::Buffer<char>>();
      cookie.bv_val = cookieBuf.Data();
      cookie.bv_len = cookieBuf.Length();
    } else {
      cookie.bv_val = nullptr;
      cookie.bv_len = 0;
    }
    LDAPControl* pageCtrl = nullptr;
    int rcCtrl = ldap_create_page_control(handle->ld, pageSize, &cookie, 0, &pageCtrl);
    if (rcCtrl != LDAP_SUCCESS) {
      FreeAttributeArray(attrs);
      throw MakeLdapError(env, rcCtrl, "ldap_create_page_control failed");
    }
    LDAPControl* ctrls[2] = {pageCtrl, nullptr};
    int rc = ldap_search_ext_s(
      handle->ld,
      baseDN.c_str(),
      ScopeFromString(scope),
      filter.c_str(),
      attrs.data(),
      0,
      ctrls,
      nullptr,
      timeLimit > 0 ? &timeout : nullptr,
      sizeLimit,
      &result);
    ldap_control_free(pageCtrl);
    FreeAttributeArray(attrs);
    if (rc != LDAP_SUCCESS && rc != LDAP_PARTIAL_RESULTS) {
      if (result) ldap_msgfree(result);
      throw MakeLdapError(env, rc, "ldap_search_ext_s failed");
    }
  } else {
    int rc = ldap_search_ext_s(
      handle->ld,
      baseDN.c_str(),
      ScopeFromString(scope),
      filter.c_str(),
      attrs.data(),
      0,
      nullptr,
      nullptr,
      timeLimit > 0 ? &timeout : nullptr,
      sizeLimit,
      &result);
    FreeAttributeArray(attrs);
    if (rc != LDAP_SUCCESS && rc != LDAP_PARTIAL_RESULTS) {
      if (result) ldap_msgfree(result);
      throw MakeLdapError(env, rc, "ldap_search_ext_s failed");
    }
  }

  Napi::Array entries = Napi::Array::New(env);
  uint32_t index = 0;
  for (LDAPMessage* entry = ldap_first_entry(handle->ld, result); entry != nullptr; entry = ldap_next_entry(handle->ld, entry)) {
    char* dn = ldap_get_dn(handle->ld, entry);
    Napi::Object jsEntry = Napi::Object::New(env);
    jsEntry.Set("dn", dn ? dn : "");
    if (dn) ldap_memfree(dn);

    BerElement* ber = nullptr;
    for (char* attr = ldap_first_attribute(handle->ld, entry, &ber); attr != nullptr; attr = ldap_next_attribute(handle->ld, entry, ber)) {
      struct berval** values = ldap_get_values_len(handle->ld, entry, attr);
      if (values != nullptr) {
        Napi::Array jsValues = Napi::Array::New(env);
        for (int i = 0; values[i] != nullptr; ++i) {
          jsValues.Set(i, Napi::String::New(env, std::string(values[i]->bv_val, values[i]->bv_len)));
        }
        jsEntry.Set(attr, jsValues);
        ldap_value_free_len(values);
      }
      ldap_memfree(attr);
    }
    if (ber) ber_free(ber, 0);
    entries.Set(index++, jsEntry);
  }

  Napi::Object output = Napi::Object::New(env);
  output.Set("entries", entries);
  output.Set("references", Napi::Array::New(env));
  output.Set("cookie", Napi::Buffer<char>::Copy(env, "", 0));

  LDAPControl** serverCtrls = nullptr;
  if (ldap_parse_result(handle->ld, result, nullptr, nullptr, nullptr, nullptr, &serverCtrls, 0) == LDAP_SUCCESS && serverCtrls != nullptr) {
    struct berval cookie{};
    unsigned long total = 0;
    if (ldap_parse_page_control(handle->ld, serverCtrls, &total, &cookie) == LDAP_SUCCESS) {
      if (cookie.bv_val != nullptr && cookie.bv_len > 0) {
        output.Set("cookie", Napi::Buffer<char>::Copy(env, cookie.bv_val, cookie.bv_len));
      }
      if (cookie.bv_val) ber_memfree(cookie.bv_val);
    }
    ldap_controls_free(serverCtrls);
  }

  if (result) ldap_msgfree(result);
  return output;
}

Napi::Value Add(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  auto entry = payload.Get("entry").As<Napi::Object>();

  std::vector<LDAPMod*> mods;
  std::vector<std::string> attrNames;
  std::vector<std::vector<std::string>> attrValues;
  std::vector<std::vector<char*>> rawValues;

  auto props = entry.GetPropertyNames();
  for (uint32_t i = 0; i < props.Length(); ++i) {
    std::string key = props.Get(i).As<Napi::String>().Utf8Value();
    attrNames.push_back(key);

    std::vector<std::string> values;
    auto jsVal = entry.Get(key);
    if (jsVal.IsArray()) {
      auto arr = jsVal.As<Napi::Array>();
      for (uint32_t j = 0; j < arr.Length(); ++j) {
        values.push_back(arr.Get(j).ToString().Utf8Value());
      }
    } else {
      values.push_back(jsVal.ToString().Utf8Value());
    }
    attrValues.push_back(values);
  }

  rawValues.resize(attrValues.size());
  mods.reserve(attrValues.size() + 1);
  for (size_t i = 0; i < attrValues.size(); ++i) {
    rawValues[i].reserve(attrValues[i].size() + 1);
    for (auto& value : attrValues[i]) {
      rawValues[i].push_back(const_cast<char*>(value.c_str()));
    }
    rawValues[i].push_back(nullptr);

    LDAPMod* mod = new LDAPMod();
    mod->mod_op = LDAP_MOD_ADD;
    mod->mod_type = const_cast<char*>(attrNames[i].c_str());
    mod->mod_values = rawValues[i].data();
    mods.push_back(mod);
  }
  mods.push_back(nullptr);

  int rc = ldap_add_ext_s(handle->ld, dn.c_str(), mods.data(), nullptr, nullptr);
  for (auto* mod : mods) {
    if (mod) delete mod;
  }
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_add_ext_s failed");
  }
  return env.Undefined();
}

Napi::Value Modify(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  auto changes = payload.Get("changes").As<Napi::Array>();

  std::vector<LDAPMod*> mods;
  std::vector<std::string> attrNames;
  std::vector<std::vector<std::string>> attrValues;
  std::vector<std::vector<char*>> rawValues;
  mods.reserve(changes.Length() + 1);
  rawValues.resize(changes.Length());

  for (uint32_t i = 0; i < changes.Length(); ++i) {
    auto change = changes.Get(i).As<Napi::Object>();
    std::string operation = change.Get("operation").ToString().Utf8Value();
    auto modification = change.Get("modification").As<Napi::Object>();
    std::string type = modification.Get("type").ToString().Utf8Value();
    attrNames.push_back(type);

    std::vector<std::string> values;
    auto vals = modification.Get("values");
    if (vals.IsArray()) {
      auto arr = vals.As<Napi::Array>();
      for (uint32_t j = 0; j < arr.Length(); ++j) {
        values.push_back(arr.Get(j).ToString().Utf8Value());
      }
    }
    attrValues.push_back(values);

    rawValues[i].reserve(values.size() + 1);
    for (auto& value : attrValues[i]) {
      rawValues[i].push_back(const_cast<char*>(value.c_str()));
    }
    rawValues[i].push_back(nullptr);

    LDAPMod* mod = new LDAPMod();
    if (operation == "add") mod->mod_op = LDAP_MOD_ADD;
    else if (operation == "delete") mod->mod_op = LDAP_MOD_DELETE;
    else mod->mod_op = LDAP_MOD_REPLACE;
    mod->mod_type = const_cast<char*>(attrNames.back().c_str());
    mod->mod_values = rawValues[i].data();
    mods.push_back(mod);
  }
  mods.push_back(nullptr);

  int rc = ldap_modify_ext_s(handle->ld, dn.c_str(), mods.data(), nullptr, nullptr);
  for (auto* mod : mods) {
    if (mod) delete mod;
  }
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_modify_ext_s failed");
  }
  return env.Undefined();
}

Napi::Value Del(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  int rc = ldap_delete_ext_s(handle->ld, dn.c_str(), nullptr, nullptr);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_delete_ext_s failed");
  }
  return env.Undefined();
}

Napi::Value Compare(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  std::string attr = payload.Get("attribute").As<Napi::String>().Utf8Value();
  std::string value = payload.Get("value").ToString().Utf8Value();

  struct berval bval;
  bval.bv_val = value.data();
  bval.bv_len = value.size();
  int msgid = 0;
  int rc = ldap_compare_ext(handle->ld, dn.c_str(), attr.c_str(), &bval, nullptr, nullptr, &msgid);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_compare_ext failed");
  }
  LDAPMessage* result = nullptr;
  rc = ldap_result(handle->ld, msgid, LDAP_MSG_ALL, nullptr, &result);
  if (rc == -1) {
    if (result) ldap_msgfree(result);
    throw Napi::Error::New(env, "ldap_result failed");
  }
  int err = LDAP_OTHER;
  ldap_parse_result(handle->ld, result, &err, nullptr, nullptr, nullptr, nullptr, 0);
  ldap_msgfree(result);
  return Napi::Boolean::New(env, err == LDAP_COMPARE_TRUE);
}

Napi::Value ModifyDN(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string dn = payload.Get("dn").As<Napi::String>().Utf8Value();
  std::string newDN = payload.Get("newDN").As<Napi::String>().Utf8Value();
  int rc = ldap_rename_s(handle->ld, dn.c_str(), newDN.c_str(), nullptr, 1, nullptr, nullptr);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_rename_s failed");
  }
  return env.Undefined();
}

Napi::Value Exop(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string oid = payload.Get("oid").As<Napi::String>().Utf8Value();
  struct berval request{};
  struct berval* requestPtr = nullptr;
  std::string requestStorage;
  if (payload.Has("value") && !payload.Get("value").IsNull() && !payload.Get("value").IsUndefined()) {
    requestStorage = payload.Get("value").ToString().Utf8Value();
    request.bv_val = requestStorage.data();
    request.bv_len = requestStorage.size();
    requestPtr = &request;
  }

  struct berval* response = nullptr;
  char* responseOid = nullptr;
  int rc = ldap_extended_operation_s(handle->ld, oid.c_str(), requestPtr, nullptr, nullptr, &responseOid, &response);
  if (rc != LDAP_SUCCESS) {
    throw MakeLdapError(env, rc, "ldap_extended_operation_s failed");
  }

  Napi::Object out = Napi::Object::New(env);
  if (responseOid) {
    out.Set("oid", Napi::String::New(env, responseOid));
    ldap_memfree(responseOid);
  }
  if (response) {
    out.Set("value", Napi::Buffer<char>::Copy(env, response->bv_val, response->bv_len));
    ber_bvfree(response);
  } else {
    out.Set("value", env.Null());
  }
  return out;
}

Napi::Value Unbind(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handleObj = info[0].As<Napi::Object>();
  uint32_t id = handleObj.Get("id").As<Napi::Number>().Uint32Value();
  auto it = g_handles.find(id);
  if (it != g_handles.end()) {
    if (it->second->ld != nullptr) {
      ldap_unbind_ext_s(it->second->ld, nullptr, nullptr);
      it->second->ld = nullptr;
    }
    g_handles.erase(it);
  }
  return env.Undefined();
}

}  // namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("connect", Napi::Function::New(env, Connect));
  exports.Set("startTLS", Napi::Function::New(env, StartTLS));
  exports.Set("bindSimple", Napi::Function::New(env, BindSimple));
  exports.Set("bindSasl", Napi::Function::New(env, BindSasl));
  exports.Set("search", Napi::Function::New(env, Search));
  exports.Set("add", Napi::Function::New(env, Add));
  exports.Set("modify", Napi::Function::New(env, Modify));
  exports.Set("del", Napi::Function::New(env, Del));
  exports.Set("compare", Napi::Function::New(env, Compare));
  exports.Set("modifyDN", Napi::Function::New(env, ModifyDN));
  exports.Set("exop", Napi::Function::New(env, Exop));
  exports.Set("unbind", Napi::Function::New(env, Unbind));
  return exports;
}

NODE_API_MODULE(ldap_native, Init)
