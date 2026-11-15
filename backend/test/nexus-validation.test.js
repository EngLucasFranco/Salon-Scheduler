const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestNexusValidation, validateAtLogin } = require('../utils/nexusValidation');

const config = {
  baseUrl: 'https://nexus.example',
  systemKey: 'SISTEMA_TESTE',
  apiKey: 'segredo',
};
const credentials = { cpf: '12345678901', name: 'Pessoa Teste', password: 'senha' };
const now = Date.parse('2026-11-14T12:00:00.000Z');

function authorized(overrides = {}) {
  return {
    online: true,
    token: 'token-nexus-temporario',
    tokenExpiresAt: '2026-11-15T12:00:00.000Z',
    tokenValidityHours: 24,
    permissions: ['AGENDA_ACESSAR'],
    ...overrides,
  };
}

function fetchResponse(status, body, onRequest = () => {}) {
  return async (url, options) => {
    onRequest();
    assert.equal(url, 'https://nexus.example/api/validate/system');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      systemKey: 'SISTEMA_TESTE',
      apiKey: 'segredo',
      cpf: '12345678901',
      name: 'Pessoa Teste',
      password: 'senha',
    });
    return { status, json: async () => body };
  };
}

test('uma tentativa autorizada faz exatamente um POST e preserva os dados da sessão', async () => {
  let calls = 0;
  const result = await requestNexusValidation(config, credentials, {
    now,
    fetchImpl: fetchResponse(200, authorized(), () => { calls += 1; }),
  });

  assert.equal(calls, 1);
  assert.equal(result.online, true);
  assert.equal(result.token, 'token-nexus-temporario');
  assert.equal(result.tokenExpiresAt, '2026-11-15T12:00:00.000Z');
  assert.equal(result.tokenValidityHours, 24);
  assert.deepEqual(result.permissions, ['AGENDA_ACESSAR']);
});

for (const invalidSession of [
  authorized({ token: '' }),
  authorized({ tokenExpiresAt: 'data-invalida' }),
  authorized({ tokenExpiresAt: '2026-11-14T11:59:59.000Z' }),
]) {
  test('online true sem token vigente não libera acesso', async () => {
    const result = await requestNexusValidation(config, credentials, {
      now,
      fetchImpl: fetchResponse(200, invalidSession),
    });
    assert.equal(result.online, false);
    assert.equal(result.reason, 'INVALID_SESSION');
  });
}

test('HTTP 403 bloqueia sem retry automático', async () => {
  let calls = 0;
  const result = await requestNexusValidation(config, credentials, {
    now,
    fetchImpl: fetchResponse(403, {
      online: false,
      reason: 'LICENSE_STATUS_BLOQUEADA',
      message: 'ACESSO NEGADO, Status Bloqueada',
    }, () => { calls += 1; }),
  });

  assert.equal(calls, 1);
  assert.equal(result.online, false);
  assert.equal(result.reason, 'LICENSE_STATUS_BLOQUEADA');
  assert.equal(result.technicalFailure, false);
});

test('resposta inválida e erro de rede bloqueiam sem retry', async (t) => {
  await t.test('JSON sem online', async () => {
    let calls = 0;
    const result = await requestNexusValidation(config, credentials, {
      fetchImpl: fetchResponse(200, { authorized: true }, () => { calls += 1; }),
    });
    assert.equal(calls, 1);
    assert.equal(result.reason, 'INVALID_RESPONSE');
  });

  await t.test('erro de rede', async () => {
    let calls = 0;
    const result = await requestNexusValidation(config, credentials, {
      fetchImpl: async () => { calls += 1; throw new Error('offline'); },
    });
    assert.equal(calls, 1);
    assert.equal(result.reason, 'NETWORK_ERROR');
  });
});

test('tentativas simultâneas idênticas compartilham uma única requisição em andamento', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const fetchImpl = async () => {
    calls += 1;
    await pending;
    return { status: 200, json: async () => authorized() };
  };
  const options = { config, fetchImpl, now };

  const first = validateAtLogin(credentials, options);
  const second = validateAtLogin(credentials, options);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.token, secondResult.token);
  assert.equal(calls, 1);
});

test('uma nova tentativa explícita após a anterior gera uma nova requisição', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { status: 200, json: async () => authorized() };
  };

  await validateAtLogin(credentials, { config, fetchImpl, now });
  await validateAtLogin(credentials, { config, fetchImpl, now });
  assert.equal(calls, 2);
});
