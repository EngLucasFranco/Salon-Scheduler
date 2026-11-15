import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearNexusSession,
  getNexusToken,
  hasValidNexusSession,
  validateAtLogin,
} from '../src/services/nexusSession.js';

const storage = new Map();
globalThis.sessionStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};

function response(overrides = {}) {
  return {
    data: {
      usuario: { id: '1', nome: 'Pessoa Teste' },
      token: 'jwt-local',
      nexusSession: {
        token: 'token-nexus',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        tokenValidityHours: 1,
        permissions: [],
        ...overrides,
      },
    },
  };
}

beforeEach(() => storage.clear());

test('um login chama o cliente HTTP uma vez e persiste a sessão temporária', async () => {
  let calls = 0;
  const client = { post: async () => { calls += 1; return response(); } };

  await validateAtLogin({ login: 'teste', senha: 'segredo' }, client);

  assert.equal(calls, 1);
  assert.equal(hasValidNexusSession(), true);
  assert.equal(getNexusToken(), 'token-nexus');
});

test('envios simultâneos do mesmo formulário compartilham uma Promise e uma requisição', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const client = {
    post: async () => {
      calls += 1;
      await pending;
      return response();
    },
  };

  const first = validateAtLogin({ login: 'teste', senha: 'segredo' }, client);
  const second = validateAtLogin({ login: 'teste', senha: 'segredo' }, client);
  assert.equal(first, second);
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('token expirado é invalidado localmente sem chamar HTTP', async () => {
  let calls = 0;
  const client = {
    post: async () => {
      calls += 1;
      return response({ tokenExpiresAt: new Date(Date.now() + 10_000).toISOString() });
    },
  };

  await validateAtLogin({ login: 'teste', senha: 'segredo' }, client);
  const future = Date.now() + 20_000;
  assert.equal(hasValidNexusSession(future), false);
  assert.equal(getNexusToken(), null);
  assert.equal(calls, 1);
});

test('limpeza de sessão remove o token sem qualquer requisição', () => {
  sessionStorage.setItem('nexus_session', JSON.stringify(response().data.nexusSession));
  clearNexusSession();
  assert.equal(getNexusToken(), null);
});
