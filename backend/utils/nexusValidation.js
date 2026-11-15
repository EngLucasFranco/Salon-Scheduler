const { createHash } = require('node:crypto');
const { getNexusAuthCredentials } = require('../config/store');

const DEFAULT_TIMEOUT_MS = 10 * 1000;
const validationsInFlight = new Map();

function technicalFailure(reason, message) {
  return { online: false, reason, message, technicalFailure: true };
}

function normalizeAuthorizedResponse(data, now) {
  const token = typeof data.token === 'string' ? data.token.trim() : '';
  const tokenExpiresAt = typeof data.tokenExpiresAt === 'string' ? data.tokenExpiresAt : '';
  const expirationTime = Date.parse(tokenExpiresAt);

  if (!token || !Number.isFinite(expirationTime) || expirationTime <= now) {
    return technicalFailure('INVALID_SESSION', 'O NexusControl devolveu uma sessão inválida.');
  }

  return {
    online: true,
    token,
    tokenExpiresAt: new Date(expirationTime).toISOString(),
    tokenValidityHours: Number.isFinite(Number(data.tokenValidityHours))
      ? Number(data.tokenValidityHours)
      : null,
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter((permission) => typeof permission === 'string')
      : [],
    user: data.user && typeof data.user === 'object' ? data.user : null,
    system: typeof data.system === 'string' ? data.system : null,
    tokenType: typeof data.tokenType === 'string' ? data.tokenType : 'Bearer',
    licenseStatus: typeof data.licenseStatus === 'string' ? data.licenseStatus : null,
    expiresAt: data.expiresAt ?? null,
    technicalFailure: false,
  };
}

async function requestNexusValidation(
  config,
  credentials = {},
  { fetchImpl = global.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, now = Date.now() } = {}
) {
  if (typeof fetchImpl !== 'function') {
    return technicalFailure('NETWORK_ERROR', 'Não foi possível consultar o NexusControl.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    systemKey: config.systemKey,
    apiKey: config.apiKey,
    ...(credentials.cpf ? { cpf: credentials.cpf } : {}),
    ...(credentials.name ? { name: credentials.name } : {}),
    ...(credentials.password ? { password: credentials.password } : {}),
  };

  try {
    const response = await fetchImpl(`${config.baseUrl}/api/validate/system`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return technicalFailure('INVALID_RESPONSE', 'O NexusControl devolveu uma resposta inválida.');
    }

    if (typeof data?.online !== 'boolean') {
      return technicalFailure('INVALID_RESPONSE', 'O NexusControl devolveu uma resposta inválida.');
    }

    if (data.online === true) return normalizeAuthorizedResponse(data, now);

    return {
      online: false,
      reason: data.reason || 'NOT_AUTHORIZED',
      message: data.message || 'A licença do programa não autoriza o acesso.',
      ...(typeof data.licenseStatus === 'string' ? { licenseStatus: data.licenseStatus } : {}),
      technicalFailure: false,
    };
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return technicalFailure(
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 'O NexusControl não respondeu dentro do prazo.' : 'Não foi possível consultar o NexusControl.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function validationIdentity(config, credentials) {
  return createHash('sha256')
    .update(config.baseUrl)
    .update('\u0000')
    .update(config.systemKey)
    .update('\u0000')
    .update(config.apiKey)
    .update('\u0000')
    .update(credentials.cpf || '')
    .update('\u0000')
    .update(credentials.name || '')
    .update('\u0000')
    .update(credentials.password || '')
    .digest('hex');
}

async function validateAtLogin(credentials, options = {}) {
  const config = options.config || await getNexusAuthCredentials();
  if (!config) {
    return technicalFailure('NOT_CONFIGURED', 'A integração com o NexusControl não está configurada.');
  }

  const identity = validationIdentity(config, credentials);
  const existing = validationsInFlight.get(identity);
  if (existing) return existing;

  const validation = requestNexusValidation(config, credentials, options)
    .finally(() => validationsInFlight.delete(identity));
  validationsInFlight.set(identity, validation);
  return validation;
}

module.exports = { requestNexusValidation, validateAtLogin };
