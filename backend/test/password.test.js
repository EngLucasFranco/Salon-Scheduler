const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const { hashPassword, verifyPassword, isPasswordHash, needsPasswordRehash } = require('../utils/password');

test('Argon2id usa os parâmetros definidos e salts diferentes para a mesma senha', async () => {
  const first = await hashPassword('Senha de teste!');
  const second = await hashPassword('Senha de teste!');
  assert.match(first, /^\$argon2id\$v=19\$/);
  assert.deepEqual(Object.fromEntries(first.split('$')[3].split(',').map((item) => item.split('='))), { m: '65536', t: '3', p: '4' });
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Senha de teste!', first), true);
  assert.equal(await verifyPassword('senha incorreta', first), false);
  assert.equal(needsPasswordRehash(first), false);
});

test('senhas Unicode e maiores que 72 bytes são verificadas integralmente', async () => {
  const prefix = 'á'.repeat(40);
  const hash = await hashPassword(`${prefix}final A`);
  assert.equal(await verifyPassword(`${prefix}final A`, hash), true);
  assert.equal(await verifyPassword(`${prefix}final B`, hash), false);
});

test('bcrypt legado continua válido e requer migração', async () => {
  const hash = await bcrypt.hash('Senha antiga!', 10);
  for (const version of ['$2a$', '$2b$', '$2y$']) {
    const legacy = version + hash.slice(4);
    assert.equal(isPasswordHash(legacy), true);
    assert.equal(await verifyPassword('Senha antiga!', legacy), true);
    assert.equal(await verifyPassword('incorreta', legacy), false);
    assert.equal(needsPasswordRehash(legacy), true);
  }
});

test('Argon2id com parâmetros antigos pode ser atualizado após autenticação', async () => {
  const hash = await argon2.hash('Senha antiga!', { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  assert.equal(await verifyPassword('Senha antiga!', hash), true);
  assert.equal(needsPasswordRehash(hash), true);
});

test('texto puro, hashes malformados e entradas inválidas não autenticam', async () => {
  for (const hash of ['senha em texto', '$argon2id$inválido', '$2b$inválido', null]) {
    assert.equal(await verifyPassword('senha em texto', hash), false);
  }
  assert.equal(await verifyPassword({}, '$argon2id$inválido'), false);
  await assert.rejects(hashPassword({}), TypeError);
  await assert.rejects(hashPassword(''), TypeError);
});
