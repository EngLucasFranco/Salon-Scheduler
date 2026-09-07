const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { verifyPassword } = require('../utils/password');
const { upgradeUserPassword } = require('../config/store');

test('modelo MongoDB aplica Argon2id ao criar e alterar a senha', async (t) => {
  let inserted;
  let updated;
  t.mock.method(User.collection, 'insertOne', async (document) => {
    inserted = { ...document };
    return { acknowledged: true, insertedId: document._id };
  });
  t.mock.method(User.collection, 'updateOne', async (filter, update) => {
    updated = update;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const user = await User.create({ nome: 'Teste Mongo', login: 'mongo001', senha: 'Senha inicial!', papel: 'cliente' });
  assert.match(inserted.senha, /^\$argon2id\$/);
  assert.equal(await user.compararSenha('Senha inicial!'), true);
  const originalHash = user.senha;
  user.nome = 'Nome alterado';
  await user.save();
  assert.equal(user.senha, originalHash);
  assert.equal(Object.hasOwn(updated.$set, 'senha'), false);
  user.senha = 'Senha alterada!';
  await user.save();
  assert.match(updated.$set.senha, /^\$argon2id\$/);
  assert.equal(await verifyPassword('Senha alterada!', updated.$set.senha), true);
  assert.equal(await user.compararSenha('Senha inicial!'), false);
  // Uma senha que parece um hash também deve ser tratada como entrada do usuário.
  user.senha = originalHash;
  await user.save();
  assert.notEqual(user.senha, originalHash);
  assert.equal(await user.compararSenha(originalHash), true);
});

test('migração MongoDB usa atualização condicional e grava um único hash', async (t) => {
  const previousProvider = process.env.DB_PROVIDER;
  process.env.DB_PROVIDER = 'mongodb';
  t.after(() => {
    if (previousProvider === undefined) delete process.env.DB_PROVIDER;
    else process.env.DB_PROVIDER = previousProvider;
  });
  const id = new User()._id;
  let modifiedCount = 1;
  t.mock.method(User, 'updateOne', async (filter, update) => {
    assert.deepEqual(filter, { _id: id, senha: 'hash-anterior' });
    assert.match(update.$set.senha, /^\$argon2id\$/);
    assert.equal(await verifyPassword('Senha legada!', update.$set.senha), true);
    assert.deepEqual(Object.keys(update.$set), ['senha']);
    return { modifiedCount };
  });
  assert.equal(await upgradeUserPassword(id, 'hash-anterior', 'Senha legada!'), true);
  modifiedCount = 0;
  assert.equal(await upgradeUserPassword(id, 'hash-anterior', 'Senha legada!'), false);
});
