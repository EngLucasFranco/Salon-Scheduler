const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabaseKeepaliveHandler } = require('../controllers/maintenanceController');

function request(key) {
  return {
    get(name) {
      return name.toLowerCase() === 'x-keepalive-key' ? key : undefined;
    },
  };
}

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function successfulConnection(onPing = () => {}) {
  return async () => ({
    connection: {
      db: {
        admin: () => ({
          ping: async () => onPing(),
        }),
      },
    },
  });
}

test('aceita chave válida, executa ping e retorna o formato esperado', async () => {
  const checkedAt = new Date('2026-11-05T03:17:00.000Z');
  let pingExecutado = false;
  const handler = createDatabaseKeepaliveHandler({
    connect: successfulConnection(() => { pingExecutado = true; }),
    getSecret: () => 'segredo-de-teste',
    now: () => checkedAt,
  });
  const res = response();

  await handler(request('segredo-de-teste'), res);

  assert.equal(res.statusCode, 200);
  assert.equal(pingExecutado, true);
  assert.deepEqual(res.body, {
    success: true,
    message: 'MongoDB keep-alive executado.',
    checkedAt: '2026-11-05T03:17:00.000Z',
  });
});

test('rejeita requisição sem chave sem acessar o banco', async () => {
  let conectou = false;
  const handler = createDatabaseKeepaliveHandler({
    connect: async () => { conectou = true; },
    getSecret: () => 'segredo-de-teste',
  });
  const res = response();

  await handler(request(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(conectou, false);
});

test('rejeita requisição com chave incorreta sem acessar o banco', async () => {
  let conectou = false;
  const handler = createDatabaseKeepaliveHandler({
    connect: async () => { conectou = true; },
    getSecret: () => 'segredo-de-teste',
  });
  const res = response();

  await handler(request('chave-incorreta'), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(conectou, false);
});

test('impede execução quando KEEPALIVE_SECRET está ausente', async () => {
  let conectou = false;
  const handler = createDatabaseKeepaliveHandler({
    connect: async () => { conectou = true; },
    getSecret: () => undefined,
  });
  const res = response();

  await handler(request('qualquer-chave'), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(conectou, false);
});

test('retorna indisponibilidade quando a conexão com o MongoDB falha', async (t) => {
  t.mock.method(console, 'error', () => {});
  const handler = createDatabaseKeepaliveHandler({
    connect: async () => { throw new Error('falha simulada'); },
    getSecret: () => 'segredo-de-teste',
  });
  const res = response();

  await handler(request('segredo-de-teste'), res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    success: false,
    message: 'Não foi possível confirmar a conexão com o MongoDB.',
  });
});

test('retorna indisponibilidade quando o comando ping falha', async (t) => {
  t.mock.method(console, 'error', () => {});
  const handler = createDatabaseKeepaliveHandler({
    connect: successfulConnection(() => { throw new Error('ping falhou'); }),
    getSecret: () => 'segredo-de-teste',
  });
  const res = response();

  await handler(request('segredo-de-teste'), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
});
