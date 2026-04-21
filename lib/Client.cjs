'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadNative } = require('./native-loader.cjs');
const controlsModule = require('./controls.cjs');

const native = loadNative();

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

function toNativeSearchOptions(options) {
  return {
    scope: options?.scope ?? 'sub',
    filter: options?.filter ?? '(objectClass=*)',
    attributes: options?.attributes ?? [],
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

function makeTempFile(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldap-native-'));
  const file = path.join(dir, 'ca.pem');
  fs.writeFileSync(file, buffer);
  return file;
}

class Client {
  constructor(options = {}) {
    if (!options.url) throw new Error('url is required');
    this.options = { strictDN: true, ...options };
    this.nativeHandle = native.connect({
      url: options.url,
      timeout: options.timeout ?? 0,
      connectTimeout: options.connectTimeout ?? 0,
      tlsOptions: options.tlsOptions ?? null,
      strictDN: options.strictDN ?? true,
    });
    this.isConnected = true;
  }

  async bind(dnOrSaslMechanism, password, controls) {
    const maybeMechanism = String(dnOrSaslMechanism || '').toUpperCase();
    const encodedControls = encodeControls(controls);
    if (['PLAIN', 'EXTERNAL', 'GSSAPI'].includes(maybeMechanism)) {
      await native.bindSasl(this.nativeHandle, {
        mechanism: maybeMechanism,
        credential: password ?? null,
        controls: encodedControls,
        sasl: this.options.sasl ?? null,
      });
      return;
    }
    await native.bindSimple(this.nativeHandle, {
      dn: dnOrSaslMechanism,
      password: password ?? '',
      controls: encodedControls,
    });
  }

  async startTLS(tlsOptions = this.options.tlsOptions) {
    const normalized = { ...(tlsOptions ?? {}) };
    if (Array.isArray(normalized.ca) && normalized.ca.length) {
      const first = normalized.ca[0];
      if (Buffer.isBuffer(first)) normalized.caFile = makeTempFile(first);
    }
    await native.startTLS(this.nativeHandle, normalized);
  }

  async search(baseDN, options = {}, controls) {
    const encodedControls = encodeControls(controls);
    const result = await native.search(this.nativeHandle, {
      baseDN,
      options: toNativeSearchOptions(options),
      controls: encodedControls,
    });
    return {
      searchEntries: result.entries,
      searchReferences: result.references ?? [],
    };
  }

  async *searchPaginated(baseDN, options = {}, controls) {
    const encodedControls = encodeControls(controls);
    let cookie = Buffer.alloc(0);
    do {
      const page = await native.search(this.nativeHandle, {
        baseDN,
        options: {
          ...toNativeSearchOptions(options),
          paged: {
            pageSize: options?.paged?.pageSize ?? 100,
            cookie,
          },
        },
        controls: encodedControls,
      });
      yield {
        searchEntries: page.entries,
        searchReferences: page.references ?? [],
      };
      cookie = page.cookie ?? Buffer.alloc(0);
    } while (cookie.length > 0);
  }

  async add(dn, entry, controls) {
    await native.add(this.nativeHandle, { dn, entry, controls: encodeControls(controls) });
  }

  async modify(dn, changes, controls) {
    const normalized = Array.isArray(changes) ? changes : [changes];
    await native.modify(this.nativeHandle, { dn, changes: normalized, controls: encodeControls(controls) });
  }

  async del(dn, controls) {
    await native.del(this.nativeHandle, { dn, controls: encodeControls(controls) });
  }

  async compare(dn, attribute, value, controls) {
    return native.compare(this.nativeHandle, {
      dn,
      attribute,
      value,
      controls: encodeControls(controls),
    });
  }

  async modifyDN(dn, newDN, controls) {
    await native.modifyDN(this.nativeHandle, {
      dn,
      newDN,
      controls: encodeControls(controls),
    });
  }

  async exop(oid, value, controls) {
    return native.exop(this.nativeHandle, { oid, value, controls: encodeControls(controls) });
  }

  async unbind() {
    if (!this.nativeHandle) return;
    await native.unbind(this.nativeHandle);
    this.nativeHandle = null;
    this.isConnected = false;
  }
}

module.exports = { Client };
