'use strict';

const handles = new Map();
let nextId = 1;

function ensure(handle) {
  const state = handles.get(handle?.id);
  if (!state) throw new Error('invalid native handle');
  return state;
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
    const cookie = Buffer.isBuffer(options.paged.cookie) ? options.paged.cookie : Buffer.alloc(0);
    if (cookie.length === 0) {
      return {
        entries: state.entries,
        references: [],
        cookie: Buffer.from('done'),
      };
    }
    return {
      entries: [],
      references: [],
      cookie: Buffer.alloc(0),
    };
  }
  return {
    entries: state.entries,
    references: [],
    cookie: Buffer.alloc(0),
  };
}

async function add(handle, payload) {
  const state = ensure(handle);
  state.entries.push({ dn: payload.dn, ...payload.entry });
}

async function modify(handle, payload) {
  ensure(handle);
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
  const expected = Buffer.isBuffer(payload.value) ? payload.value.toString('utf8') : String(payload.value);
  return values.map(String).includes(expected);
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
};
