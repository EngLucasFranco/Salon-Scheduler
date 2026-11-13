const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('agenda fixa sincroniza agendas abertas e é aplicada em novas agendas', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agenda-fixa-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
  process.env.JWT_SECRET = 'segredo-exclusivo-para-testes-automatizados';

  const store = require('../config/store');
  const profissionalController = require('../controllers/professionalController');
  const usuarioController = require('../controllers/userController');
  const agendaController = require('../controllers/availabilityController');
  const db = await store.connectStore();
  t.after(async () => {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  });

  const gestor = { id: 'gestor-agenda-fixa', nome: 'Gestor', papel: 'gestor' };
  const profissionalRes = response();
  await profissionalController.criar({
    body: { nome: 'Profissional fixa', intervalos: [{ descricao: 'Almoço', inicio: '12:00', fim: '13:00' }] },
    usuario: gestor,
  }, profissionalRes);
  const profissional = profissionalRes.body;
  const servico = await store.createService({ nome: 'Serviço fixo', tipo: 'servico', valor: 50, duracaoMinutos: 60, criadoPor: gestor.id });
  const cliente = await store.createUser({ nome: 'Cliente fixa', login: 'clientefixa', senha: 'Senha fixa!', papel: 'cliente' });

  const slots = (prefixo) => [
    { _id: `${prefixo}-09`, horario: '09:00', status: 'disponivel' },
    { _id: `${prefixo}-0930`, horario: '09:30', status: 'disponivel' },
    { _id: `${prefixo}-10`, horario: '10:00', status: 'disponivel' },
    { _id: `${prefixo}-1030`, horario: '10:30', status: 'disponivel' },
    { _id: `${prefixo}-12`, horario: '12:00', status: 'bloqueado', descricaoIntervalo: 'Almoço' },
    { _id: `${prefixo}-1230`, horario: '12:30', status: 'bloqueado', descricaoIntervalo: 'Almoço' },
  ];
  await store.saveAgenda({ data: '2032-01-05', profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: true, intervalo: 30, slots: slots('livre') });
  const slotsConflito = slots('conflito');
  slotsConflito[0] = { ...slotsConflito[0], status: 'reservado', cliente: null, clienteNome: 'Outra cliente', reservaId: 'manual' };
  await store.saveAgenda({ data: '2032-01-06', profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: true, intervalo: 30, slots: slotsConflito });
  await store.saveAgenda({ data: '2032-01-07', profissionalId: profissional.id, profissionalNome: profissional.nome, aberta: false, intervalo: 30, slots: slots('fechada') });

  const atualizarRes = response();
  await usuarioController.atualizar({
    params: { id: cliente.id },
    body: {
      ...store.safeUser(cliente), senha: '',
      agendaFixa: { ativa: true, profissionalId: profissional.id, frequencia: 'diario', horario: '09:00', servicoId: servico.id, inicioEm: '2032-01-01' },
    },
  }, atualizarRes);
  assert.equal(atualizarRes.statusCode, 200);

  const livre = await store.findAgenda('2032-01-05', profissional.id);
  assert.deepEqual(livre.slots.slice(0, 2).map((slot) => slot.status), ['reservado', 'reservado']);
  assert.ok(livre.slots.slice(0, 2).every((slot) => slot.agendaFixa && slot.cliente === String(cliente.id)));
  const conflito = await store.findAgenda('2032-01-06', profissional.id);
  assert.equal(conflito.slots[0].clienteNome, 'Outra cliente');
  assert.equal(conflito.slots[1].status, 'disponivel');
  const fechada = await store.findAgenda('2032-01-07', profissional.id);
  assert.ok(fechada.slots.every((slot) => slot.status !== 'reservado'));

  const abrirRes = response();
  await agendaController.abrirAgenda({
    body: { data: '2032-01-08', inicio: '09:00', fim: '13:00', intervalo: 30, profissionalId: profissional.id },
    usuario: gestor,
  }, abrirRes);
  assert.equal(abrirRes.statusCode, 201);
  assert.deepEqual(abrirRes.body.slots.slice(0, 2).map((slot) => slot.status), ['reservado', 'reservado']);
  assert.ok(abrirRes.body.slots.slice(0, 2).every((slot) => slot.agendaFixa));

  const intervaloRes = response();
  await usuarioController.atualizar({
    params: { id: cliente.id },
    body: {
      ...atualizarRes.body, senha: '',
      agendaFixa: { ...atualizarRes.body.agendaFixa, horario: '12:00' },
    },
  }, intervaloRes);
  assert.equal(intervaloRes.statusCode, 400);
  assert.match(intervaloRes.body.mensagem, /intervalo/i);
  const preservada = await store.findAgenda('2032-01-05', profissional.id);
  assert.deepEqual(preservada.slots.slice(0, 2).map((slot) => slot.status), ['reservado', 'reservado']);

  const cancelarRes = response();
  await agendaController.cancelarMinhaReserva({
    params: { data: '2032-01-05', slotId: preservada.slots[0]._id },
    usuario: store.safeUser(await store.findUserById(cliente.id)),
  }, cancelarRes);
  assert.equal(cancelarRes.statusCode, 200);

  const remarcarRes = response();
  await agendaController.reservarSlot({
    params: { data: '2032-01-05', slotId: preservada.slots[2]._id },
    body: { profissionalId: profissional.id, servicos: [servico.id] },
    query: {},
    usuario: store.safeUser(await store.findUserById(cliente.id)),
  }, remarcarRes);
  assert.equal(remarcarRes.statusCode, 200);

  const notificacoes = await store.listNotificationsForUser({ id: 'colaborador-fixa', papel: 'colaborador', profissionalId: profissional.id });
  assert.ok(notificacoes.some((item) => item.titulo === 'Reserva cancelada pela cliente' && item.horarioReserva === '09:00'));
  assert.ok(notificacoes.some((item) => item.titulo === 'Nova reserva na agenda' && item.horarioReserva === '10:00'));

  const configuracoes = await store.getGeneralSettings();
  await store.saveGeneralSettings({ ...configuracoes, permitirCancelamentoCliente: false });
  const cancelamentoBloqueadoRes = response();
  await agendaController.cancelarMinhaReserva({
    params: { data: '2032-01-05', slotId: remarcarRes.body.slot._id },
    usuario: store.safeUser(await store.findUserById(cliente.id)),
  }, cancelamentoBloqueadoRes);
  assert.equal(cancelamentoBloqueadoRes.statusCode, 400);
  assert.match(cancelamentoBloqueadoRes.body.mensagem, /cancelamento pela cliente não está disponível/i);
  assert.equal((await store.findAgenda('2032-01-05', profissional.id)).slots[2].status, 'reservado');

  const cancelamentoProfissionalRes = response();
  await agendaController.cancelarReservaGestor({
    params: { data: '2032-01-05', slotId: remarcarRes.body.slot._id },
    body: {}, query: {}, usuario: { id: 'colaborador-fixa', papel: 'colaborador', profissionalId: profissional.id },
  }, cancelamentoProfissionalRes);
  assert.equal(cancelamentoProfissionalRes.statusCode, 200);
  assert.equal((await store.findAgenda('2032-01-05', profissional.id)).slots[2].status, 'disponivel');
});
