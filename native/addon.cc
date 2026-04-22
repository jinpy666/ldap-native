#include <napi.h>
#include <ldap.h>

#include <algorithm>
#include <cctype>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

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

Napi::Error MakeOptionError(Napi::Env env, const std::string& msg) {
  return MakeLdapError(env, LDAP_LOCAL_ERROR, msg);
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

std::string ToLowerCopy(const std::string& value) {
  std::string lower = value;
  std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char ch) {
    return static_cast<char>(std::tolower(ch));
  });
  return lower;
}

bool EndsWith(const std::string& value, const std::string& suffix) {
  return value.size() >= suffix.size()
    && value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string ReadUtf8String(const Napi::Object& object, const char* key, const std::string& fallback = "") {
  if (!object.Has(key)) return fallback;
  auto value = object.Get(key);
  if (value.IsUndefined() || value.IsNull()) return fallback;
  return value.ToString().Utf8Value();
}

bool ReadBoolean(const Napi::Object& object, const char* key, bool fallback) {
  if (!object.Has(key)) return fallback;
  auto value = object.Get(key);
  if (!value.IsBoolean()) return fallback;
  return value.As<Napi::Boolean>().Value();
}

std::vector<std::string> ReadByteStrings(const Napi::Value& value) {
  std::vector<std::string> values;
  if (value.IsUndefined() || value.IsNull()) {
    return values;
  }

  auto append = [&values](const Napi::Value& entry) {
    if (entry.IsUndefined() || entry.IsNull()) return;
    if (entry.IsBuffer()) {
      auto buffer = entry.As<Napi::Buffer<char>>();
      values.emplace_back(buffer.Data(), buffer.Length());
      return;
    }
    values.push_back(entry.ToString().Utf8Value());
  };

  if (value.IsArray()) {
    auto array = value.As<Napi::Array>();
    values.reserve(array.Length());
    for (uint32_t i = 0; i < array.Length(); ++i) {
      append(array.Get(i));
    }
    return values;
  }

  append(value);
  return values;
}

std::vector<std::string> ReadStringArray(const Napi::Value& value) {
  std::vector<std::string> values;
  if (!value.IsArray()) return values;

  auto array = value.As<Napi::Array>();
  values.reserve(array.Length());
  for (uint32_t i = 0; i < array.Length(); ++i) {
    auto entry = array.Get(i);
    if (!entry.IsUndefined() && !entry.IsNull()) {
      values.push_back(entry.ToString().Utf8Value());
    }
  }
  return values;
}

void CollectEntryAttributes(
  const Napi::Value& entryValue,
  std::vector<std::string>& attrNames,
  std::vector<std::vector<std::string>>& attrValues
) {
  if (entryValue.IsArray()) {
    auto array = entryValue.As<Napi::Array>();
    attrNames.reserve(array.Length());
    attrValues.reserve(array.Length());
    for (uint32_t i = 0; i < array.Length(); ++i) {
      auto attribute = array.Get(i);
      if (!attribute.IsObject()) continue;
      auto attributeObject = attribute.As<Napi::Object>();
      attrNames.push_back(attributeObject.Get("type").ToString().Utf8Value());
      attrValues.push_back(ReadByteStrings(attributeObject.Get("values")));
    }
    return;
  }

  auto entry = entryValue.As<Napi::Object>();
  auto props = entry.GetPropertyNames();
  attrNames.reserve(props.Length());
  attrValues.reserve(props.Length());

  for (uint32_t i = 0; i < props.Length(); ++i) {
    std::string key = props.Get(i).As<Napi::String>().Utf8Value();
    attrNames.push_back(key);
    attrValues.push_back(ReadByteStrings(entry.Get(key)));
  }
}

int MapTlsProtocolMin(const std::string& minVersion) {
  if (minVersion == "TLSv1") return LDAP_OPT_X_TLS_PROTOCOL_TLS1_0;
  if (minVersion == "TLSv1.0") return LDAP_OPT_X_TLS_PROTOCOL_TLS1_0;
  if (minVersion == "TLSv1.1") return LDAP_OPT_X_TLS_PROTOCOL_TLS1_1;
  if (minVersion == "TLSv1.2") return LDAP_OPT_X_TLS_PROTOCOL_TLS1_2;
  if (minVersion == "TLSv1.3") return LDAP_OPT_X_TLS_PROTOCOL_TLS1_3;
  return 0;
}

int MapDerefAliases(const std::string& derefAliases) {
  if (derefAliases == "always") return LDAP_DEREF_ALWAYS;
  if (derefAliases == "find") return LDAP_DEREF_FINDING;
  if (derefAliases == "search") return LDAP_DEREF_SEARCHING;
  return LDAP_DEREF_NEVER;
}

int ScopeFromString(const std::string& scope) {
  if (scope == "base") return LDAP_SCOPE_BASE;
  if (scope == "one") return LDAP_SCOPE_ONELEVEL;
  if (scope == "sub") return LDAP_SCOPE_SUBTREE;
  if (scope == "children" || scope == "subordinates") {
#if defined(LDAP_SCOPE_CHILDREN)
    return LDAP_SCOPE_CHILDREN;
#elif defined(LDAP_SCOPE_SUBORDINATE)
    return LDAP_SCOPE_SUBORDINATE;
#else
    return LDAP_SCOPE_SUBTREE;
#endif
  }
  return LDAP_SCOPE_SUBTREE;
}

bool ShouldReturnBuffer(const std::string& attribute, const std::vector<std::string>& explicitBufferAttributes) {
  std::string normalizedAttribute = ToLowerCopy(attribute);
  if (EndsWith(normalizedAttribute, ";binary")) return true;

  std::string baseAttribute = normalizedAttribute;
  std::size_t optionIndex = baseAttribute.find(';');
  if (optionIndex != std::string::npos) {
    baseAttribute = baseAttribute.substr(0, optionIndex);
  }

  for (const auto& requested : explicitBufferAttributes) {
    std::string normalizedRequested = ToLowerCopy(requested);
    if (normalizedRequested == normalizedAttribute || normalizedRequested == baseAttribute) {
      return true;
    }
  }
  return false;
}

void SetObjectPropertyString(
  Napi::Env env,
  Napi::Object& object,
  const std::string& property,
  const std::string& value
) {
  object.Set(property, Napi::String::New(env, value));
}

bool SetLdapOptionOnGlobalAndHandle(LDAP* ld, int option, const void* invalue) {
  bool applied = false;

  // OpenLDAP TLS options are not consistently scoped across client library
  // builds. Some libldap variants only honor the global option, while others
  // honor the per-handle value. Apply both and accept either success path.
  if (ldap_set_option(nullptr, option, invalue) == LDAP_OPT_SUCCESS) {
    applied = true;
  }

  if (ld != nullptr && ldap_set_option(ld, option, invalue) == LDAP_OPT_SUCCESS) {
    applied = true;
  }

  return applied;
}

void ApplyTlsOptions(Napi::Env env, LDAP* ld, const Napi::Object& options) {
  auto setStringOption = [&](const char* key, int option, const char* name) {
    if (!options.Has(key) || !options.Get(key).IsString()) return;
    std::string value = options.Get(key).As<Napi::String>().Utf8Value();
    if (!SetLdapOptionOnGlobalAndHandle(ld, option, value.c_str())) {
      throw MakeOptionError(env, std::string("ldap_set_option failed for ") + name);
    }
  };

  setStringOption("caFile", LDAP_OPT_X_TLS_CACERTFILE, "LDAP_OPT_X_TLS_CACERTFILE");
  setStringOption("certFile", LDAP_OPT_X_TLS_CERTFILE, "LDAP_OPT_X_TLS_CERTFILE");
  setStringOption("keyFile", LDAP_OPT_X_TLS_KEYFILE, "LDAP_OPT_X_TLS_KEYFILE");
  setStringOption("ciphers", LDAP_OPT_X_TLS_CIPHER_SUITE, "LDAP_OPT_X_TLS_CIPHER_SUITE");

  int requireCert = ReadBoolean(options, "rejectUnauthorized", true)
    ? LDAP_OPT_X_TLS_HARD
    : LDAP_OPT_X_TLS_NEVER;
  if (!SetLdapOptionOnGlobalAndHandle(ld, LDAP_OPT_X_TLS_REQUIRE_CERT, &requireCert)) {
    throw MakeOptionError(env, "ldap_set_option failed for LDAP_OPT_X_TLS_REQUIRE_CERT");
  }

  if (options.Has("minVersion") && options.Get("minVersion").IsString()) {
    int protocolMin = MapTlsProtocolMin(options.Get("minVersion").As<Napi::String>().Utf8Value());
    if (protocolMin != 0 &&
        !SetLdapOptionOnGlobalAndHandle(ld, LDAP_OPT_X_TLS_PROTOCOL_MIN, &protocolMin)) {
      throw MakeOptionError(env, "ldap_set_option failed for LDAP_OPT_X_TLS_PROTOCOL_MIN");
    }
  }

  int newContext = 0;
  if (!SetLdapOptionOnGlobalAndHandle(ld, LDAP_OPT_X_TLS_NEWCTX, &newContext)) {
    throw MakeOptionError(env, "ldap_set_option failed for LDAP_OPT_X_TLS_NEWCTX");
  }
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
    auto timeout = options.Get("timeout").As<Napi::Number>().Int64Value();
    if (timeout > 0) {
      tv.tv_sec = static_cast<long>(timeout / 1000);
      tv.tv_usec = static_cast<long>((timeout % 1000) * 1000);
      ldap_set_option(ld, LDAP_OPT_TIMEOUT, &tv);
    }
  }

  if (options.Has("connectTimeout") && options.Get("connectTimeout").IsNumber()) {
    struct timeval tv{};
    auto timeout = options.Get("connectTimeout").As<Napi::Number>().Int64Value();
    if (timeout > 0) {
      tv.tv_sec = static_cast<long>(timeout / 1000);
      tv.tv_usec = static_cast<long>((timeout % 1000) * 1000);
      ldap_set_option(ld, LDAP_OPT_NETWORK_TIMEOUT, &tv);
    }
  }

  if (options.Has("tlsOptions") && options.Get("tlsOptions").IsObject()) {
    ApplyTlsOptions(env, ld, options.Get("tlsOptions").As<Napi::Object>());
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
    ApplyTlsOptions(env, handle->ld, info[1].As<Napi::Object>());
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
  struct berval cred{};
  struct berval* credPtr = nullptr;
  std::string credStorage;

  if (payload.Has("credential") && !payload.Get("credential").IsNull() && !payload.Get("credential").IsUndefined()) {
    if (payload.Get("credential").IsBuffer()) {
      auto buffer = payload.Get("credential").As<Napi::Buffer<char>>();
      credStorage.assign(buffer.Data(), buffer.Length());
    } else {
      credStorage = payload.Get("credential").ToString().Utf8Value();
    }
    cred.bv_val = credStorage.empty() ? nullptr : credStorage.data();
    cred.bv_len = credStorage.size();
    credPtr = &cred;
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

Napi::Value Search(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto handle = GetHandle(info);
  auto payload = info[1].As<Napi::Object>();
  std::string baseDN = payload.Get("baseDN").As<Napi::String>().Utf8Value();
  auto options = payload.Get("options").As<Napi::Object>();
  std::string filter = options.Get("filter").As<Napi::String>().Utf8Value();
  std::string scope = ReadUtf8String(options, "scope", "sub");
  int derefAliases = MapDerefAliases(ReadUtf8String(options, "derefAliases", "never"));
  int sizeLimit = options.Has("sizeLimit") ? options.Get("sizeLimit").As<Napi::Number>().Int32Value() : 0;
  int timeLimit = options.Has("timeLimit") ? options.Get("timeLimit").As<Napi::Number>().Int32Value() : 0;
  int attrsOnly = ReadBoolean(options, "returnAttributeValues", true) ? 0 : 1;
  std::vector<std::string> explicitBufferAttributes = ReadStringArray(options.Get("explicitBufferAttributes"));

  if (ldap_set_option(handle->ld, LDAP_OPT_DEREF, &derefAliases) != LDAP_OPT_SUCCESS) {
    throw MakeOptionError(env, "ldap_set_option failed for LDAP_OPT_DEREF");
  }

  auto attrs = BuildAttributeArray(options.Get("attributes"));
  LDAPMessage* result = nullptr;
  struct timeval timeout{};
  timeout.tv_sec = timeLimit > 0 ? timeLimit : 0;
  timeout.tv_usec = 0;

  if (options.Has("paged") && options.Get("paged").IsObject()) {
    auto paged = options.Get("paged").As<Napi::Object>();
    int pageSize = paged.Get("pageSize").As<Napi::Number>().Int32Value();
    struct berval cookie{};
    if (paged.Has("cookie") && paged.Get("cookie").IsBuffer()) {
      auto cookieBuf = paged.Get("cookie").As<Napi::Buffer<char>>();
      cookie.bv_val = cookieBuf.Data();
      cookie.bv_len = cookieBuf.Length();
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
      attrsOnly,
      ctrls,
      nullptr,
      timeLimit > 0 ? &timeout : nullptr,
      sizeLimit,
      &result);
    ldap_control_free(pageCtrl);
    FreeAttributeArray(attrs);

    if (rc != LDAP_SUCCESS && rc != LDAP_PARTIAL_RESULTS && rc != LDAP_SIZELIMIT_EXCEEDED) {
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
      attrsOnly,
      nullptr,
      nullptr,
      timeLimit > 0 ? &timeout : nullptr,
      sizeLimit,
      &result);
    FreeAttributeArray(attrs);

    if (rc != LDAP_SUCCESS && rc != LDAP_PARTIAL_RESULTS && rc != LDAP_SIZELIMIT_EXCEEDED) {
      if (result) ldap_msgfree(result);
      throw MakeLdapError(env, rc, "ldap_search_ext_s failed");
    }
  }

  Napi::Array entries = Napi::Array::New(env);
  uint32_t entryIndex = 0;

  for (LDAPMessage* entry = ldap_first_entry(handle->ld, result);
       entry != nullptr;
       entry = ldap_next_entry(handle->ld, entry)) {
    char* dn = ldap_get_dn(handle->ld, entry);
    Napi::Object jsEntry = Napi::Object::New(env);
    SetObjectPropertyString(env, jsEntry, "dn", dn ? dn : "");
    if (dn) ldap_memfree(dn);

    BerElement* ber = nullptr;
    for (char* attr = ldap_first_attribute(handle->ld, entry, &ber);
         attr != nullptr;
         attr = ldap_next_attribute(handle->ld, entry, ber)) {
      struct berval** values = ldap_get_values_len(handle->ld, entry, attr);
      if (values != nullptr) {
        Napi::Array jsValues = Napi::Array::New(env);
        bool returnBuffer = ShouldReturnBuffer(attr, explicitBufferAttributes);
        for (int i = 0; values[i] != nullptr; ++i) {
          if (returnBuffer) {
            jsValues.Set(i, Napi::Buffer<char>::Copy(env, values[i]->bv_val, values[i]->bv_len));
          } else {
            jsValues.Set(i, Napi::String::New(env, std::string(values[i]->bv_val, values[i]->bv_len)));
          }
        }
        jsEntry.Set(attr, jsValues);
        ldap_value_free_len(values);
      }
      ldap_memfree(attr);
    }
    if (ber) ber_free(ber, 0);
    entries.Set(entryIndex++, jsEntry);
  }

  Napi::Object output = Napi::Object::New(env);
  output.Set("entries", entries);
  output.Set("references", Napi::Array::New(env));
  output.Set("cookie", Napi::Buffer<char>::Copy(env, "", 0));

  LDAPControl** serverCtrls = nullptr;
  if (ldap_parse_result(handle->ld, result, nullptr, nullptr, nullptr, nullptr, &serverCtrls, 0) == LDAP_SUCCESS &&
      serverCtrls != nullptr) {
    struct berval cookie{};
    ber_int_t total = 0;
    LDAPControl* pagedCtrl = nullptr;
    for (int i = 0; serverCtrls[i] != nullptr; ++i) {
      if (serverCtrls[i]->ldctl_oid != nullptr &&
          std::string(serverCtrls[i]->ldctl_oid) == LDAP_CONTROL_PAGEDRESULTS) {
        pagedCtrl = serverCtrls[i];
        break;
      }
    }
    if (pagedCtrl && ldap_parse_pageresponse_control(handle->ld, pagedCtrl, &total, &cookie) == LDAP_SUCCESS) {
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

  std::vector<LDAPMod*> mods;
  std::vector<std::string> attrNames;
  std::vector<std::vector<std::string>> attrValues;
  std::vector<std::vector<berval>> rawValues;
  std::vector<std::vector<berval*>> rawPointers;

  CollectEntryAttributes(payload.Get("entry"), attrNames, attrValues);
  rawValues.resize(attrValues.size());
  rawPointers.resize(attrValues.size());
  mods.reserve(attrValues.size() + 1);

  for (size_t i = 0; i < attrValues.size(); ++i) {
    rawValues[i].reserve(attrValues[i].size());
    rawPointers[i].reserve(attrValues[i].size() + 1);
    for (auto& value : attrValues[i]) {
      berval bval{};
      bval.bv_val = value.empty() ? const_cast<char*>("") : const_cast<char*>(value.data());
      bval.bv_len = value.size();
      rawValues[i].push_back(bval);
    }
    for (auto& bval : rawValues[i]) {
      rawPointers[i].push_back(&bval);
    }
    rawPointers[i].push_back(nullptr);

    LDAPMod* mod = new LDAPMod();
    mod->mod_op = LDAP_MOD_ADD | LDAP_MOD_BVALUES;
    mod->mod_type = const_cast<char*>(attrNames[i].c_str());
    mod->mod_bvalues = rawPointers[i].data();
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
  std::vector<std::vector<berval>> rawValues;
  std::vector<std::vector<berval*>> rawPointers;

  mods.reserve(changes.Length() + 1);
  rawValues.resize(changes.Length());
  rawPointers.resize(changes.Length());

  for (uint32_t i = 0; i < changes.Length(); ++i) {
    auto change = changes.Get(i).As<Napi::Object>();
    std::string operation = change.Get("operation").ToString().Utf8Value();
    auto modification = change.Get("modification").As<Napi::Object>();
    std::string type = modification.Get("type").ToString().Utf8Value();
    attrNames.push_back(type);
    attrValues.push_back(ReadByteStrings(modification.Get("values")));

    rawValues[i].reserve(attrValues[i].size());
    rawPointers[i].reserve(attrValues[i].size() + 1);
    for (auto& value : attrValues[i]) {
      berval bval{};
      bval.bv_val = value.empty() ? const_cast<char*>("") : const_cast<char*>(value.data());
      bval.bv_len = value.size();
      rawValues[i].push_back(bval);
    }
    for (auto& bval : rawValues[i]) {
      rawPointers[i].push_back(&bval);
    }
    rawPointers[i].push_back(nullptr);

    LDAPMod* mod = new LDAPMod();
    if (operation == "add") mod->mod_op = LDAP_MOD_ADD;
    else if (operation == "delete") mod->mod_op = LDAP_MOD_DELETE;
    else mod->mod_op = LDAP_MOD_REPLACE;
    mod->mod_op |= LDAP_MOD_BVALUES;
    mod->mod_type = const_cast<char*>(attrNames.back().c_str());
    mod->mod_bvalues = rawPointers[i].data();
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
  std::vector<std::string> values = ReadByteStrings(payload.Get("value"));
  std::string value = values.empty() ? std::string() : values.front();

  struct berval bval{};
  bval.bv_val = value.empty() ? nullptr : value.data();
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

  std::string newRDN = newDN;
  std::string newParent;
  auto comma = newDN.find(',');
  if (comma != std::string::npos) {
    newRDN = newDN.substr(0, comma);
    newParent = newDN.substr(comma + 1);
  }

  std::string currentParent;
  auto dnComma = dn.find(',');
  if (dnComma != std::string::npos) {
    currentParent = dn.substr(dnComma + 1);
  }

  bool sameParent = newParent.empty() || currentParent == newParent;
  const char* newParentPtr = sameParent ? nullptr : newParent.c_str();

  int rc = ldap_rename_s(handle->ld, dn.c_str(), newRDN.c_str(), newParentPtr, 1, nullptr, nullptr);
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
    std::vector<std::string> values = ReadByteStrings(payload.Get("value"));
    if (!values.empty()) {
      requestStorage = values.front();
      request.bv_val = requestStorage.empty() ? nullptr : requestStorage.data();
      request.bv_len = requestStorage.size();
      requestPtr = &request;
    }
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
