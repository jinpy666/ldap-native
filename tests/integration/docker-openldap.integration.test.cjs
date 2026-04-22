'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { getConfig, createClient, uniqueDN } = require('../helpers/docker-env.cjs');

const config = getConfig();
const skip = !config.url;

function bindAdmin(client) {
  return client.bind(config.bindDN, config.bindPassword);
}

// ── Connection & Bind ──────────────────────────────────────

test('simple bind + unbind', { skip }, async () => {
  const client = createClient();
  await bindAdmin(client);
  assert.equal(client.isConnected, true);
  await client.unbind();
  assert.equal(client.isConnected, false);
});

test('bind with wrong password throws', { skip }, async () => {
  const client = createClient();
  await assert.rejects(
    () => client.bind(config.bindDN, 'wrong-password'),
    (err) => {
      assert.ok(err.message.length > 0);
      return true;
    },
  );
  await client.unbind();
});

// ── Search ──────────────────────────────────────────────────

test('search with equality filter', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const result = await client.search('ou=users,dc=example,dc=com', {
      scope: 'one',
      filter: '(uid=jdoe)',
      attributes: ['cn', 'uid', 'mail'],
    });
    assert.equal(result.searchEntries.length, 1);
    const entry = result.searchEntries[0];
    assert.equal(entry.uid[0], 'jdoe');
    assert.equal(entry.cn[0], 'John Doe');
    assert.equal(entry.mail[0], 'jdoe@example.com');
  } finally {
    await client.unbind();
  }
});

test('search with subtree scope', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const result = await client.search(config.baseDN, {
      scope: 'sub',
      filter: '(objectClass=organizationalUnit)',
      attributes: ['ou'],
    });
    assert.ok(result.searchEntries.length >= 3, 'should find at least 3 OUs');
  } finally {
    await client.unbind();
  }
});

test('search with sizeLimit', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const result = await client.search(config.baseDN, {
      scope: 'sub',
      filter: '(objectClass=*)',
      sizeLimit: 1,
    });
    assert.equal(result.searchEntries.length, 1);
  } finally {
    await client.unbind();
  }
});

test('search with paged results returns all entries', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const result = await client.search(config.baseDN, {
      scope: 'sub',
      filter: '(objectClass=inetOrgPerson)',
      attributes: ['uid'],
      paged: { pageSize: 2 },
    });
    assert.ok(result.searchEntries.length > 2, 'search() should aggregate every paged result');
  } finally {
    await client.unbind();
  }
});

// ── Add ─────────────────────────────────────────────────────

test('add + search + verify', { skip }, async () => {
  const client = createClient();
  const testDN = uniqueDN('test-add', 'ou=users,dc=example,dc=com');
  try {
    await bindAdmin(client);
    await client.add(testDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'Test Add',
      sn: 'Add',
      uid: 'testadd',
      mail: 'testadd@example.com',
    });

    const result = await client.search(testDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['cn', 'sn', 'uid', 'mail'],
    });
    assert.equal(result.searchEntries.length, 1);
    const entry = result.searchEntries[0];
    assert.equal(entry.cn[0], 'Test Add');
    assert.equal(entry.sn[0], 'Add');
    assert.equal(entry.uid[0], 'testadd');
    assert.equal(entry.mail[0], 'testadd@example.com');
  } finally {
    await client.del(testDN).catch(() => {});
    await client.unbind();
  }
});

// ── Modify ──────────────────────────────────────────────────

test('modify replace attribute', { skip }, async () => {
  const client = createClient();
  const testDN = uniqueDN('test-mod-replace', 'ou=users,dc=example,dc=com');
  try {
    await bindAdmin(client);
    await client.add(testDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'Mod Replace',
      sn: 'Replace',
      uid: 'modrepl',
      mail: 'old@example.com',
    });

    await client.modify(testDN, [{
      operation: 'replace',
      modification: { type: 'mail', values: ['new@example.com'] },
    }]);

    const result = await client.search(testDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['mail'],
    });
    assert.equal(result.searchEntries[0].mail[0], 'new@example.com');
  } finally {
    await client.del(testDN).catch(() => {});
    await client.unbind();
  }
});

test('modify add and delete attribute', { skip }, async () => {
  const client = createClient();
  const testDN = uniqueDN('test-mod-add', 'ou=users,dc=example,dc=com');
  try {
    await bindAdmin(client);
    await client.add(testDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'Mod Add',
      sn: 'Add',
      uid: 'modadd',
      mail: 'modadd@example.com',
    });

    await client.modify(testDN, [{
      operation: 'add',
      modification: { type: 'description', values: ['A test description'] },
    }]);

    let result = await client.search(testDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['description'],
    });
    assert.equal(result.searchEntries[0].description[0], 'A test description');

    await client.modify(testDN, [{
      operation: 'delete',
      modification: { type: 'description', values: ['A test description'] },
    }]);

    result = await client.search(testDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['description'],
    });
    assert.ok(
      !result.searchEntries[0].description,
      'description should be removed',
    );
  } finally {
    await client.del(testDN).catch(() => {});
    await client.unbind();
  }
});

// ── Del ─────────────────────────────────────────────────────

test('del removes entry', { skip }, async () => {
  const client = createClient();
  const testDN = uniqueDN('test-del', 'ou=users,dc=example,dc=com');
  try {
    await bindAdmin(client);
    await client.add(testDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'To Delete',
      sn: 'Delete',
      uid: 'todelete',
      mail: 'del@example.com',
    });

    await client.del(testDN);

    // Search for deleted entry should throw "No such object"
    await assert.rejects(
      () => client.search(testDN, { scope: 'base', filter: '(objectClass=*)' }),
      (err) => err.code === 32,
    );
  } finally {
    await client.del(testDN).catch(() => {});
    await client.unbind();
  }
});

// ── Compare ─────────────────────────────────────────────────

test('compare returns true/false', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const match = await client.compare(
      'uid=jdoe,ou=users,dc=example,dc=com',
      'uid',
      'jdoe',
    );
    assert.equal(match, true);

    const noMatch = await client.compare(
      'uid=jdoe,ou=users,dc=example,dc=com',
      'uid',
      'nonexistent',
    );
    assert.equal(noMatch, false);
  } finally {
    await client.unbind();
  }
});

// ── ModifyDN ────────────────────────────────────────────────

test('modifyDN renames entry', { skip }, async () => {
  const client = createClient();
  const parentDN = 'ou=users,dc=example,dc=com';
  const oldDN = uniqueDN('old-name', parentDN);
  const suffix = crypto.randomBytes(4).toString('hex');
  const newRDN = `cn=new-name-${suffix}`;
  const newDN = `${newRDN},${parentDN}`;
  try {
    await bindAdmin(client);
    await client.add(oldDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'Old Name',
      sn: 'Name',
      uid: 'oldname',
    });

    await client.modifyDN(oldDN, newDN);

    const result = await client.search(newDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['cn'],
    });
    assert.equal(result.searchEntries.length, 1);
  } finally {
    await client.del(newDN).catch(() => {});
    await client.del(oldDN).catch(() => {});
    await client.unbind();
  }
});

test('modifyDN accepts RDN-only rename', { skip }, async () => {
  const client = createClient();
  const parentDN = 'ou=users,dc=example,dc=com';
  const oldDN = uniqueDN('old-rdn', parentDN);
  const suffix = crypto.randomBytes(4).toString('hex');
  const newRDN = `cn=renamed-rdn-${suffix}`;
  const newDN = `${newRDN},${parentDN}`;
  try {
    await bindAdmin(client);
    await client.add(oldDN, {
      objectClass: ['inetOrgPerson'],
      cn: 'Old RDN',
      sn: 'Name',
      uid: `oldrdn-${suffix}`,
    });

    await client.modifyDN(oldDN, newRDN);

    const result = await client.search(newDN, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['cn'],
    });
    assert.equal(result.searchEntries.length, 1);
  } finally {
    await client.del(newDN).catch(() => {});
    await client.del(oldDN).catch(() => {});
    await client.unbind();
  }
});

// ── Exop ────────────────────────────────────────────────────

test('exop Who Am I', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const response = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    assert.ok(Buffer.isBuffer(response.value), 'value should be a Buffer');
    const whoami = response.value.toString('utf8');
    assert.ok(whoami.length > 0, 'whoami should not be empty');
  } finally {
    await client.unbind();
  }
});

// ── SearchPaginated ────────────────────────────────────────

test('searchPaginated yields pages', { skip }, async () => {
  const client = createClient();
  try {
    await bindAdmin(client);
    const allEntries = [];
    for await (const page of client.searchPaginated(config.baseDN, {
      scope: 'sub',
      filter: '(objectClass=inetOrgPerson)',
      attributes: ['uid'],
      paged: { pageSize: 2 },
    })) {
      assert.ok(Array.isArray(page.searchEntries));
      allEntries.push(...page.searchEntries);
    }
    assert.ok(allEntries.length >= 3, 'should find seeded users across pages');
  } finally {
    await client.unbind();
  }
});

// ── StartTLS ────────────────────────────────────────────────

test('startTLS upgrades connection', { skip: skip || !config.caFilePath }, async () => {
  const client = createClient();
  try {
    await client.startTLS({ caFile: config.caFilePath });
    await bindAdmin(client);

    const result = await client.search('ou=users,dc=example,dc=com', {
      scope: 'one',
      filter: '(uid=jdoe)',
      attributes: ['cn'],
    });
    assert.equal(result.searchEntries.length, 1);
  } finally {
    await client.unbind();
  }
});

test('startTLS + exop Who Am I', { skip: skip || !config.caFilePath }, async () => {
  const client = createClient();
  try {
    await client.startTLS({ caFile: config.caFilePath });
    await bindAdmin(client);

    const response = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    assert.ok(Buffer.isBuffer(response.value));
    const whoami = response.value.toString('utf8');
    assert.ok(whoami.length > 0);
  } finally {
    await client.unbind();
  }
});

// ── SASL EXTERNAL over TLS ──────────────────────────────────

test('SASL EXTERNAL bind after startTLS', { skip: skip || !config.caFilePath || 'SASL EXTERNAL requires ldapi:// (Unix socket), unavailable from macOS host' }, async () => {
  const client = createClient();
  try {
    await client.startTLS({ caFile: config.caFilePath });
    await client.bind('EXTERNAL');
  } finally {
    await client.unbind();
  }
});
