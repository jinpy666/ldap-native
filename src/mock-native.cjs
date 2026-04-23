'use strict';

const handles = new Map();
let nextId = 1;

function ensure(handle) {
  const state = handles.get(handle?.id);
  if (!state) throw new Error('invalid native handle');
  return state;
}

function cloneValue(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  return value;
}

function cloneEntry(entry) {
  const cloned = {};
  for (const [key, value] of Object.entries(entry)) {
    cloned[key] = Array.isArray(value) ? value.map(cloneValue) : cloneValue(value);
  }
  return cloned;
}

function normalizeEntry(entry) {
  if (Array.isArray(entry)) {
    return entry.reduce((acc, attribute) => {
      acc[attribute.type] = [...(attribute.values ?? [])];
      return acc;
    }, {});
  }
  return { ...entry };
}

function parseCookie(cookie) {
  if (!Buffer.isBuffer(cookie) || cookie.length === 0) return 0;
  const offset = Number.parseInt(cookie.toString('utf8'), 10);
  return Number.isFinite(offset) ? offset : 0;
}

function valuesEqual(left, right) {
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return left.equals(right);
  if (Buffer.isBuffer(left) || Buffer.isBuffer(right)) {
    const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(String(left));
    const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(String(right));
    return leftBuffer.equals(rightBuffer);
  }
  return String(left) === String(right);
}

function connect(options) {
  const handle = { id: nextId++ };
  handles.set(handle.id, {
    options,
    startedTLS: false,
    bound: false,
    bind: null,
    entries: [
      {
        dn: 'uid=jdoe,ou=people,dc=example,dc=com',
        cn: ['John Doe'],
        uid: ['jdoe'],
        mail: ['jdoe@example.com'],
        displayName: [' John Doe '],
        entryLabel: '  Primary User  ',
        memberOf: [
          ' cn=dev,ou=groups,dc=example,dc=com ',
          ' cn=ops,ou=groups,dc=example,dc=com ',
        ],
        jpegPhoto: [Buffer.from([0x00, 0xff, 0x01])],
      },
      {
        dn: 'uid=asmith,ou=people,dc=example,dc=com',
        cn: ['Alice Smith'],
        uid: ['asmith'],
        mail: ['asmith@example.com'],
      },
      {
        dn: 'uid=bjones,ou=people,dc=example,dc=com',
        cn: ['Bob Jones'],
        uid: ['bjones'],
        mail: ['bjones@example.com'],
      },
    ],
  });
  return handle;
}

async function startTLS(handle, tlsOptions) {
  const state = ensure(handle);
  state.startedTLS = true;
  state.tlsOptions = tlsOptions;
}

async function bindSimple(handle, payload) {
  const state = ensure(handle);
  state.bound = true;
  state.bind = { type: 'simple', ...payload };
}

async function bindSasl(handle, payload) {
  const state = ensure(handle);
  state.bound = true;
  state.bind = { type: 'sasl', ...payload };
}

async function search(handle, payload) {
  const state = ensure(handle);
  const options = payload.options || {};
  if (options.paged) {
    const pageSize = options.paged.pageSize || 100;
    const offset = parseCookie(options.paged.cookie);
    const entries = state.entries.slice(offset, offset + pageSize).map(cloneEntry);
    const nextOffset = offset + entries.length;
    return {
      entries,
      references: [],
      cookie: nextOffset < state.entries.length ? Buffer.from(String(nextOffset)) : Buffer.alloc(0),
    };
  }
  return {
    entries: state.entries.map(cloneEntry),
    references: [],
    cookie: Buffer.alloc(0),
  };
}

async function add(handle, payload) {
  const state = ensure(handle);
  state.entries.push({ dn: payload.dn, ...normalizeEntry(payload.entry) });
}

async function modify(handle, payload) {
  const state = ensure(handle);
  const entry = state.entries.find((item) => item.dn === payload.dn);
  if (!entry) return payload;

  for (const change of payload.changes || []) {
    const attribute = change.modification?.type;
    const values = [...(change.modification?.values ?? [])];
    if (!attribute) continue;

    if (change.operation === 'add') {
      entry[attribute] = [...(entry[attribute] ?? []), ...values];
      continue;
    }

    if (change.operation === 'delete') {
      if (values.length === 0) {
        delete entry[attribute];
      } else {
        entry[attribute] = (entry[attribute] ?? []).filter((value) => !values.some((candidate) => valuesEqual(value, candidate)));
        if (entry[attribute].length === 0) delete entry[attribute];
      }
      continue;
    }

    if (values.length === 0) {
      delete entry[attribute];
    } else {
      entry[attribute] = values;
    }
  }

  return payload;
}

async function del(handle, payload) {
  const state = ensure(handle);
  state.entries = state.entries.filter((entry) => entry.dn !== payload.dn);
}

async function compare(handle, payload) {
  const state = ensure(handle);
  const entry = state.entries.find((item) => item.dn === payload.dn);
  if (!entry) return false;
  const values = entry[payload.attribute] || [];
  return values.some((value) => valuesEqual(value, payload.value));
}

async function modifyDN(handle, payload) {
  const state = ensure(handle);
  const entry = state.entries.find((item) => item.dn === payload.dn);
  if (entry) entry.dn = payload.newDN;
}

async function exop(handle, payload) {
  ensure(handle);
  if (payload.oid === '1.3.6.1.4.1.4203.1.11.3') {
    return { value: Buffer.from('dn:uid=jdoe,ou=people,dc=example,dc=com') };
  }
  return { value: payload.value ?? null };
}

async function unbind(handle) {
  handles.delete(handle?.id);
}

function __getState(handle) {
  const state = ensure(handle);
  return {
    ...state,
    bind: state.bind ? { ...state.bind } : null,
    tlsOptions: state.tlsOptions ? { ...state.tlsOptions } : undefined,
  };
}

module.exports = {
  connect,
  startTLS,
  bindSimple,
  bindSasl,
  search,
  add,
  modify,
  del,
  compare,
  modifyDN,
  exop,
  unbind,
  __getState,
};
