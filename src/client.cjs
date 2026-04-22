'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadNative } = require('./native-loader.cjs');
const controlsModule = require('./runtime.cjs');
const { StatusCodeParser } = require('./runtime.cjs');

const native = loadNative();

function convertNativeError(err) {
  if (err && typeof err.code === 'number') {
    const converted = StatusCodeParser.parse({ status: err.code, errorMessage: err.message });
    converted.cause = err;
    return converted;
  }
  return err;
}

function wrapNativeCall(fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.catch((err) => { throw convertNativeError(err); });
    }
    return result;
  } catch (err) {
    throw convertNativeError(err);
  }
}

function normalizeControls(controls) {
  if (!controls) return [];
  if (Array.isArray(controls)) return controls;
  return [controls];
}

function encodeControl(control) {
  if (!control) return null;
  if (control instanceof controlsModule.PagedResultsControl) {
    return {
      type: 'paged',
      pageSize: control.value?.size ?? control.size ?? 100,
      cookie: control.value?.cookie ?? Buffer.alloc(0),
      criticality: Boolean(control.criticality),
    };
  }
  if (control instanceof controlsModule.ServerSideSortingRequestControl) {
    return {
      type: 'sort',
      value: control.value,
      criticality: Boolean(control.criticality),
    };
  }
  return {
    type: 'generic',
    oid: control.type,
    criticality: Boolean(control.criticality),
    value: control.value,
  };
}

function encodeControls(controls) {
  return normalizeControls(controls).map(encodeControl).filter(Boolean);
}

function normalizeFilter(filter) {
  if (filter == null) return '(objectClass=*)';
  if (typeof filter === 'string') return filter;
  if (typeof filter.toString === 'function') return filter.toString();
  throw new TypeError('search filter must be a string or filter object');
}

function toNativeSearchOptions(options) {
  return {
    scope: options?.scope ?? 'sub',
    filter: normalizeFilter(options?.filter),
    derefAliases: options?.derefAliases ?? 'never',
    returnAttributeValues: options?.returnAttributeValues !== false,
    attributes: options?.attributes ?? [],
    explicitBufferAttributes: options?.explicitBufferAttributes ?? [],
    sizeLimit: options?.sizeLimit ?? 0,
    timeLimit: options?.timeLimit ?? 0,
    paged: options?.paged
      ? {
          pageSize: typeof options.paged === 'object' ? options.paged.pageSize ?? 100 : 100,
          cookie: typeof options.paged === 'object' ? options.paged.cookie ?? Buffer.alloc(0) : Buffer.alloc(0),
        }
      : null,
  };
}

function makeTempFile(prefix, filename, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, filename);
  fs.writeFileSync(file, contents);
  return { file, cleanupPath: dir };
}

function normalizeTlsValue(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const parts = value
      .filter((entry) => entry != null)
      .map((entry) => Buffer.isBuffer(entry) ? entry : Buffer.from(String(entry)));
    return parts.length > 0 ? Buffer.concat(parts) : null;
  }
  return Buffer.isBuffer(value) ? value : Buffer.from(String(value));
}

function normalizeTlsOptions(tlsOptions, tempPaths) {
  if (!tlsOptions) return null;

  const normalized = { ...tlsOptions };
  const ca = !normalized.caFile ? normalizeTlsValue(normalized.ca) : null;
  const cert = !normalized.certFile ? normalizeTlsValue(normalized.cert) : null;
  const key = !normalized.keyFile ? normalizeTlsValue(normalized.key) : null;

  if (ca) {
    const temp = makeTempFile('ldap-native-ca-', 'ca.pem', ca);
    normalized.caFile = temp.file;
    tempPaths.add(temp.cleanupPath);
  }

  if (cert) {
    const temp = makeTempFile('ldap-native-cert-', 'cert.pem', cert);
    normalized.certFile = temp.file;
    tempPaths.add(temp.cleanupPath);
  }

  if (key) {
    const temp = makeTempFile('ldap-native-key-', 'key.pem', key);
    normalized.keyFile = temp.file;
    tempPaths.add(temp.cleanupPath);
  }

  delete normalized.ca;
  delete normalized.cert;
  delete normalized.key;
  return normalized;
}

function cleanupTempPaths(tempPaths) {
  for (const tempPath of tempPaths) {
    try {
      fs.rmSync(tempPath, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup for temp TLS material.
    }
  }
  tempPaths.clear();
}

async function runSearch(nativeHandle, baseDN, options, controls) {
  return wrapNativeCall(() => native.search(nativeHandle, {
    baseDN,
    options,
    controls,
  }));
}

function buildPagedSearchOptions(options, cookie) {
  return {
    ...toNativeSearchOptions(options),
    paged: {
      pageSize: typeof options?.paged === 'object' ? options.paged.pageSize ?? 100 : 100,
      cookie,
    },
  };
}

function toSearchResult(result) {
  return {
    searchEntries: result.entries ?? [],
    searchReferences: result.references ?? [],
  };
}

class Client {
  constructor(options = {}) {
    if (!options.url) throw new Error('url is required');

    this.options = { strictDN: true, ...options };
    this.tempPaths = new Set();

    try {
      this.nativeHandle = native.connect({
        url: options.url,
        timeout: typeof options.timeout === 'number' ? options.timeout : undefined,
        connectTimeout: typeof options.connectTimeout === 'number' ? options.connectTimeout : undefined,
        tlsOptions: normalizeTlsOptions(options.tlsOptions, this.tempPaths),
        strictDN: options.strictDN ?? true,
      });
    } catch (err) {
      cleanupTempPaths(this.tempPaths);
      throw err;
    }

    this.isConnected = true;
  }

  async bind(dnOrSaslMechanism, password, controls) {
    const maybeMechanism = String(dnOrSaslMechanism || '').toUpperCase();
    const encodedControls = encodeControls(controls);
    if (['PLAIN', 'EXTERNAL', 'GSSAPI'].includes(maybeMechanism)) {
      await wrapNativeCall(() => native.bindSasl(this.nativeHandle, {
        mechanism: maybeMechanism,
        credential: password ?? null,
        controls: encodedControls,
        sasl: this.options.sasl ?? null,
      }));
      return;
    }
    await wrapNativeCall(() => native.bindSimple(this.nativeHandle, {
      dn: dnOrSaslMechanism,
      password: password ?? '',
      controls: encodedControls,
    }));
  }

  async startTLS(tlsOptions = this.options.tlsOptions, controls) {
    const normalized = normalizeTlsOptions(tlsOptions, this.tempPaths) ?? {};
    await wrapNativeCall(() => native.startTLS(
      this.nativeHandle,
      {
        ...normalized,
        controls: encodeControls(controls),
      },
    ));
  }

  async search(baseDN, options = {}, controls) {
    const encodedControls = encodeControls(controls);
    if (options?.paged) {
      const result = {
        searchEntries: [],
        searchReferences: [],
      };
      let cookie = Buffer.alloc(0);

      do {
        const page = await runSearch(this.nativeHandle, baseDN, buildPagedSearchOptions(options, cookie), encodedControls);
        result.searchEntries.push(...(page.entries ?? []));
        result.searchReferences.push(...(page.references ?? []));
        cookie = page.cookie ?? Buffer.alloc(0);
      } while (cookie.length > 0);

      return result;
    }

    const result = await runSearch(this.nativeHandle, baseDN, toNativeSearchOptions(options), encodedControls);
    return toSearchResult(result);
  }

  async *searchPaginated(baseDN, options = {}, controls) {
    const encodedControls = encodeControls(controls);
    let cookie = Buffer.alloc(0);

    do {
      const page = await runSearch(this.nativeHandle, baseDN, buildPagedSearchOptions(options, cookie), encodedControls);
      yield toSearchResult(page);
      cookie = page.cookie ?? Buffer.alloc(0);
    } while (cookie.length > 0);
  }

  async add(dn, entry, controls) {
    await wrapNativeCall(() => native.add(this.nativeHandle, { dn, entry, controls: encodeControls(controls) }));
  }

  async modify(dn, changes, controls) {
    const normalized = Array.isArray(changes) ? changes : [changes];
    await wrapNativeCall(() => native.modify(this.nativeHandle, { dn, changes: normalized, controls: encodeControls(controls) }));
  }

  async del(dn, controls) {
    await wrapNativeCall(() => native.del(this.nativeHandle, { dn, controls: encodeControls(controls) }));
  }

  async compare(dn, attribute, value, controls) {
    return wrapNativeCall(() => native.compare(this.nativeHandle, {
      dn,
      attribute,
      value,
      controls: encodeControls(controls),
    }));
  }

  async modifyDN(dn, newDN, controls) {
    await wrapNativeCall(() => native.modifyDN(this.nativeHandle, {
      dn,
      newDN,
      controls: encodeControls(controls),
    }));
  }

  async exop(oid, value, controls) {
    return wrapNativeCall(() => native.exop(this.nativeHandle, { oid, value, controls: encodeControls(controls) }));
  }

  async unbind() {
    if (!this.nativeHandle) return;
    try {
      await wrapNativeCall(() => native.unbind(this.nativeHandle));
    } finally {
      this.nativeHandle = null;
      this.isConnected = false;
      cleanupTempPaths(this.tempPaths);
    }
  }
}

module.exports = { Client };
