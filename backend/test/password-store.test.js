const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { hashPassword, verifyPassword } = require('../utils/password');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('persistência SQLite e autenticação com migração de senhas', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agenda-password-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
  process.env.JWT_SECRET = 'segredo-exclusivo-para-testes-automatizados';
  let db;
  t.after(async () => {
    if (db) await db.close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('agenda-password-test-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const legacyHash = await bcrypt.hash('Senha antiga!', 10);
  const currentHash = await hashPassword('Senha atual!');
  db = await open({ filename: process.env.SQLITE_PATH, driver: sqlite3.Database });
  await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, login TEXT NOT NULL UNIQUE, telefone TEXT, senha TEXT NOT NULL, papel TEXT NOT NULL)');
  for (const [login, senha] of [['legado01', legacyHash], ['atual001', currentHash], ['texto001', 'Senha antiga em texto!']]) {
    await db.run('INSERT INTO users (nome, login, senha, papel) VALUES (?, ?, ?, ?)', login, login, senha, 'cliente');
  }
  await db.close();
  db = null;
  const store = require('../config/store');
  const auth = require('../controllers/authController');
  db = await store.connectStore();

  await t.test('inicialização preserva hashes existentes e converte apenas texto puro', async () => {
    assert.equal((await store.findUserByLogin('legado01')).senha, legacyHash);
    assert.equal((await store.findUserByLogin('atual001')).senha, currentHash);
    const converted = await store.findUserByLogin('texto001');
    assert.match(converted.senha, /^\$argon2id\$/);
    assert.equal(await verifyPassword('Senha antiga em texto!', converted.senha), true);
    for (const login of ['010101', '020202']) assert.match((await store.findUserByLogin(login)).senha, /^\$argon2id\$/);
  });

  await t.test('cadastro público grava Argon2id e não devolve o hash', async () => {
    const res = response();
    await auth.registrar({ body: { nome: 'Cadastro teste', login: 'novo0001', senha: 'Senha nova!' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(Object.hasOwn(res.body.usuario, 'senha'), false);
    assert.equal(Object.hasOwn(jwt.decode(res.body.token), 'exp'), false);
    const user = await store.findUserByLogin('novo0001');
    assert.match(user.senha, /^\$argon2id\$/);
    assert.equal(await verifyPassword('Senha nova!', user.senha), true);
  });

  await t.test('login inválido não altera bcrypt; login válido migra e mantém o perfil', async () => {
    let res = response();
    await auth.login({ body: { login: 'legado01', senha: 'incorreta' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.mensagem, 'Usuário ou senha inválidos.');
    assert.equal((await store.findUserByLogin('legado01')).senha, legacyHash);
    const before = store.safeUser(await store.findUserByLogin('legado01'));
    res = response();
    await auth.login({ body: { login: 'legado01', senha: 'Senha antiga!' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
    assert.equal(Object.hasOwn(res.body.usuario, 'senha'), false);
    const user = await store.findUserByLogin('legado01');
    assert.match(user.senha, /^\$argon2id\$/);
    assert.equal(await verifyPassword('Senha antiga!', user.senha), true);
    assert.deepEqual(store.safeUser(user), before);
    await auth.login({ body: { login: 'legado01', senha: 'Senha antiga!' } }, response());
    assert.equal((await store.findUserByLogin('legado01')).senha, user.senha);
  });

  await t.test('editar o perfil preserva o hash; trocar senha invalida a anterior', async () => {
    const user = await store.findUserByLogin('novo0001');
    const edited = await store.updateUser(user.id, { ...user, nome: 'Nome editado', senha: '' });
    assert.equal(edited.senha, user.senha);
    const changed = await store.updateUser(user.id, { ...edited, senha: 'Senha alterada!' });
    assert.match(changed.senha, /^\$argon2id\$/);
    assert.equal(await verifyPassword('Senha nova!', changed.senha), false);
    assert.equal(await verifyPassword('Senha alterada!', changed.senha), true);
  });

  await t.test('migração atrasada não sobrescreve uma troca de senha', async () => {
    const user = await store.findUserByLogin('atual001');
    const changed = await store.updateUser(user.id, { ...user, senha: 'Senha trocada!' });
    assert.equal(await store.upgradeUserPassword(user.id, user.senha, 'Senha atual!'), false);
    assert.equal((await store.findUserById(user.id)).senha, changed.senha);
  });

  await t.test('bloquear horário localiza a agenda pelo profissional selecionado', async () => {
    const { criar: criarProfissional } = require('../controllers/professionalController');
    const agendaController = require('../controllers/availabilityController');
    const gestor = { id: 'gestor-teste', papel: 'gestor' };
    const profissionalRes = response();
    await criarProfissional({ body: { nome: 'Profissional de agenda' }, usuario: gestor }, profissionalRes);
    assert.equal(profissionalRes.statusCode, 201);
    const profissionalId = profissionalRes.body.id;
    const agenda = {
      data: '2030-01-10', profissionalId, profissionalNome: profissionalRes.body.nome, aberta: true, intervalo: 30,
      slots: [{ _id: 'slot-bloqueio', horario: '09:00', status: 'disponivel' }],
    };
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS agendas_data_profissional_unique ON agendas(data, profissional_id)');
    await store.saveAgenda(agenda);
    const bloquear = () => agendaController.bloquearSlot({
      params: { data: agenda.data, slotId: 'slot-bloqueio' }, query: { profissionalId }, body: {}, usuario: gestor,
    }, response());
    const primeiro = await bloquear();
    assert.equal(primeiro.statusCode, 200);
    assert.equal(primeiro.body.slots[0].status, 'bloqueado');
    const segundo = await bloquear();
    assert.equal(segundo.statusCode, 200);
    assert.equal(segundo.body.slots[0].status, 'disponivel');
  });

  await t.test('gestor marca para cliente cadastrada ou avulsa e a cadastrada vê sua reserva', async () => {
    const agendaController = require('../controllers/availabilityController');
    const gestor = { id: 'gestor-marcacao', nome: 'Gestor de marcação', papel: 'gestor' };
    const profissionalRes = response();
    await require('../controllers/professionalController').criar({ body: { nome: 'Profissional de marcação' }, usuario: gestor }, profissionalRes);
    const cliente = await store.createUser({ nome: 'Cliente cadastrada', login: 'cliente01', telefone: '11999999999', senha: 'Senha cliente!', papel: 'cliente' });
    const colaborador = await store.createUser({ nome: 'Colaborador', login: 'colabora01', senha: 'Senha colaborador!', papel: 'colaborador', profissionalId: profissionalRes.body.id });
    const servico = await store.createService({ nome: 'Serviço de marcação', tipo: 'servico', valor: 50, duracaoMinutos: 30, criadoPor: gestor.id });
    await store.saveAgenda({
      data: '2030-01-11', profissionalId: profissionalRes.body.id, profissionalNome: profissionalRes.body.nome, aberta: true, intervalo: 30,
      slots: [
        { _id: 'cliente-1', horario: '09:00', status: 'disponivel' }, { _id: 'cliente-2', horario: '09:30', status: 'disponivel' },
        { _id: 'avulsa-1', horario: '10:00', status: 'disponivel' },
      ],
    });
    await store.saveAgenda({ data: '2000-01-01', profissionalId: profissionalRes.body.id, profissionalNome: profissionalRes.body.nome, aberta: true, intervalo: 30, slots: [] });
    const abertasRes = response();
    await agendaController.listarAgendasAbertas({ query: {} }, abertasRes);
    assert.deepEqual(abertasRes.body.find((item) => item.data === '2030-01-11' && item.profissionalId === profissionalRes.body.id), {
      data: '2030-01-11', profissionalId: profissionalRes.body.id, profissionalNome: 'Profissional de marcação',
    });
    assert.equal(abertasRes.body.some((item) => item.data === '2000-01-01'), false);
    const clientesRes = response();
    await agendaController.listarClientes({ usuario: gestor }, clientesRes);
    assert.deepEqual(clientesRes.body.find((item) => item.id === String(cliente.id)), { id: String(cliente.id), nome: 'Cliente cadastrada', telefone: '11999999999' });
    assert.equal(clientesRes.body.some((item) => item.id === String(colaborador.id)), false);

    const registrar = async (slotId, body, usuario = gestor) => {
      const res = response();
      await agendaController.marcarHorarioParaCliente({ params: { data: '2030-01-11', slotId }, body: { profissionalId: profissionalRes.body.id, servicos: [servico.id], ...body }, query: {}, usuario }, res);
      return res;
    };
    const cadastrada = await registrar('cliente-1', { clienteId: String(cliente.id) });
    assert.equal(cadastrada.statusCode, 201);
    assert.equal(cadastrada.body.slot.cliente, String(cliente.id));
    assert.equal(cadastrada.body.slot.clienteNome, cliente.nome);
    const minhasRes = response();
    await agendaController.minhasReservas({ usuario: store.safeUser(cliente) }, minhasRes);
    assert.deepEqual(minhasRes.body.map((item) => ({ data: item.data, horario: item.horario, servico: item.servico })), [{ data: '2030-01-11', horario: '09:00', servico: 'Serviço de marcação' }]);

    const avulsa = await registrar('avulsa-1', { clienteNome: 'Cliente avulsa' }, store.safeUser(colaborador));
    assert.equal(avulsa.statusCode, 201);
    assert.equal(avulsa.body.slot.cliente, null);
    assert.equal(avulsa.body.slot.clienteNome, 'Cliente avulsa');
    const semNome = await registrar('cliente-2', { clienteNome: '  ' });
    assert.equal(semNome.statusCode, 400);
  });

  await t.test('reiniciar o armazenamento preserva os hashes Argon2id', async () => {
    const before = await db.all('SELECT id, senha FROM users ORDER BY id');
    await db.close();
    db = null;
    delete require.cache[require.resolve('../config/store')];
    db = await require('../config/store').connectStore();
    assert.deepEqual(await db.all('SELECT id, senha FROM users ORDER BY id'), before);
  });
});
