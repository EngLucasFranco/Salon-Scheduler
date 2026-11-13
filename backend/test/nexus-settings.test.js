const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('configuração NexusControl é criptografada e nunca exposta pela leitura pública', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agenda-nexus-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = path.join(directory, 'test.sqlite');
  process.env.NEXUS_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const store = require('../config/store');
  const controller = require('../controllers/settingController');
  const db = await store.connectStore();
  t.after(async () => {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  });

  assert.deepEqual(await store.getNexusAuthSettings(), { configurado: false });
  const credentials = { baseUrl: 'http://localhost:3002', systemKey: 'SALAO_TESTE', apiKey: 'segredo-nexus-control' };
  const saveResponse = response();
  await controller.atualizarAutenticacaoNexus({ body: credentials }, saveResponse);
  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(saveResponse.body, { configurado: true });
  const readResponse = response();
  await controller.obterAutenticacaoNexus({}, readResponse);
  assert.deepEqual(readResponse.body, { configurado: true });
  assert.deepEqual(await store.getNexusAuthSettings(), { configurado: true });
  assert.deepEqual(await store.getNexusAuthCredentials(), credentials);

  const records = await db.all("SELECT chave, valor FROM app_settings WHERE chave LIKE 'nexus_%' ORDER BY chave");
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.match(record.valor, /^nexus:v1:/);
    assert.equal(record.valor.includes(credentials.baseUrl), false);
    assert.equal(record.valor.includes(credentials.systemKey), false);
    assert.equal(record.valor.includes(credentials.apiKey), false);
  }

  const key = process.env.NEXUS_CONFIG_ENCRYPTION_KEY;
  delete process.env.NEXUS_CONFIG_ENCRYPTION_KEY;
  await assert.rejects(store.getNexusAuthCredentials(), /NEXUS_CONFIG_ENCRYPTION_KEY/);
  process.env.NEXUS_CONFIG_ENCRYPTION_KEY = key;
});
