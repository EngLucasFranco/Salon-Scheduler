const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestNexusValidation } = require('../utils/nexusValidation');

const config = {
  baseUrl: 'https://nexus.example',
  systemKey: 'SISTEMA_TESTE',
  apiKey: 'segredo',
};

function fetchResponse(status, body) {
  return async (url, options) => {
    assert.equal(url, 'https://nexus.example/api/validate/system');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { systemKey: 'SISTEMA_TESTE', apiKey: 'segredo' });
    return { status, json: async () => body };
  };
}

test('NexusControl libera somente quando online é true e a licença está ATIVA', async () => {
  const result = await requestNexusValidation(config, {
    fetchImpl: fetchResponse(200, { online: true, licenseStatus: 'ATIVA', permissions: [] }),
  });
  assert.equal(result.online, true);
  assert.equal(result.licenseStatus, 'ATIVA');
});

for (const licenseStatus of ['BLOQUEADA', 'EXPIRADA', 'SUSPENSA']) {
  test(`licença ${licenseStatus} não libera nem diante de online true inconsistente`, async () => {
    const result = await requestNexusValidation(config, {
      fetchImpl: fetchResponse(200, { online: true, licenseStatus }),
    });
    assert.equal(result.online, false);
    assert.equal(result.licenseStatus, licenseStatus);
    assert.equal(result.reason, `LICENSE_STATUS_${licenseStatus}`);
    assert.equal(result.technicalFailure, false);
  });
}

test('licença bloqueada é uma negação de negócio e não autoriza o programa', async () => {
  const result = await requestNexusValidation(config, {
    fetchImpl: fetchResponse(403, {
      online: false,
      reason: 'LICENSE_STATUS_BLOQUEADA',
      message: 'ACESSO NEGADO, Status Bloqueada',
      licenseStatus: 'BLOQUEADA',
    }),
  });
  assert.deepEqual(result, {
    online: false,
    reason: 'LICENSE_STATUS_BLOQUEADA',
    message: 'ACESSO NEGADO, Status Bloqueada',
    licenseStatus: 'BLOQUEADA',
    technicalFailure: false,
  });
});

test('resposta sem online booleano falha de forma segura', async () => {
  const result = await requestNexusValidation(config, {
    fetchImpl: fetchResponse(200, { authorized: true, message: 'Sistema autorizado.' }),
  });
  assert.equal(result.online, false);
  assert.equal(result.reason, 'INVALID_RESPONSE');
  assert.equal(result.technicalFailure, true);
});

test('erro de rede falha de forma segura', async () => {
  const result = await requestNexusValidation(config, {
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.online, false);
  assert.equal(result.reason, 'NETWORK_ERROR');
  assert.equal(result.technicalFailure, true);
});
