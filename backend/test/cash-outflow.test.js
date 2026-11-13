const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('saídas reduzem o saldo e são arquivadas no fechamento do caixa', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agenda-cash-outflow-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
  process.env.JWT_SECRET = 'segredo-exclusivo-para-testes-automatizados';

  const store = require('../config/store');
  const controller = require('../controllers/chargeController');
  const db = await store.connectStore();

  t.after(async () => {
    await db.close();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('agenda-cash-outflow-test-'));
    await rm(resolved, { recursive: true, force: true });
  });

  await store.createCharge({
    data: '2026-11-13', agendaData: '2026-11-13', reservaId: 'reserva-historico',
    clienteNome: 'Cliente do histórico', profissionalNome: 'Profissional teste',
    formaPagamentoId: 'pix', formaPagamentoNome: 'PIX',
    formasPagamento: [{ formaPagamentoId: 'pix', formaPagamentoNome: 'PIX', valor: 150 }],
    itens: [{ catalogoId: 'servico-1', nome: 'Serviço teste', tipo: 'servico', quantidade: 1, valorUnitario: 150, custoUnitario: 0 }],
    desconto: 0, acrescimo: 0, total: 150, criadoPor: null,
  });

  let res = response();
  await controller.criarSaida({ body: { data: '2026-11-13', valor: 0, meioPagamento: 'PIX' }, usuario: { id: 'gestor' } }, res);
  assert.equal(res.statusCode, 400);

  res = response();
  await controller.criarSaida({ body: { data: '2026-11-13', valor: 10, meioPagamento: 'Cheque' }, usuario: { id: 'gestor' } }, res);
  assert.equal(res.statusCode, 400);

  for (const [valor, meioPagamento] of [[50.25, 'Dinheiro'], [30.25, 'Cartão de Débito']]) {
    res = response();
    await controller.criarSaida({ body: { data: '2026-11-13', valor, meioPagamento }, usuario: { id: 'gestor' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.meioPagamento, meioPagamento);
  }

  assert.equal((await store.listCashOutflowsByDate('2026-11-13')).length, 2);
  const fechamento = await store.closeCashRegister('2026-11-13', null);
  assert.equal(fechamento.total, 150);
  assert.equal(fechamento.totalSaidas, 80.5);
  assert.equal(fechamento.saldo, 69.5);
  assert.equal(fechamento.quantidadePagamentos, 1);
  assert.equal(fechamento.cobrancas[0].clienteNome, 'Cliente do histórico');
  assert.equal(fechamento.cobrancas[0].itens[0].nome, 'Serviço teste');
  assert.equal(fechamento.quantidadeSaidas, 2);
  assert.equal(fechamento.saidas.length, 2);
  const diasRetencao = (new Date(fechamento.expiraEm).getTime() - Date.now()) / 86400000;
  assert.ok(diasRetencao > 119 && diasRetencao <= 120, `retenção inesperada: ${diasRetencao} dias`);
  assert.deepEqual(await store.listCashOutflowsByDate('2026-11-13'), []);
});
