const { getNexusAuthCredentials } = require('../config/store');
const { createHash } = require('node:crypto');

const SUCCESS_CACHE_MS = 3 * 60 * 1000;
const DENIAL_CACHE_MS = 15 * 1000;
const DEFAULT_TIMEOUT_MS = 10 * 1000;

let cache = null;

function technicalFailure(reason, message) {
  return { online: false, reason, message, technicalFailure: true };
}

async function requestNexusValidation(config, { fetchImpl = global.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== 'function') {
    return technicalFailure('NETWORK_ERROR', 'Não foi possível consultar o NexusControl.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${config.baseUrl}/api/validate/system`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemKey: config.systemKey, apiKey: config.apiKey }),
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

    const licenseStatus = typeof data.licenseStatus === 'string'
      ? data.licenseStatus.trim().toUpperCase()
      : '';

    if (data.online === true && licenseStatus === 'ATIVA') {
      return {
        online: true,
        licenseStatus,
        expiresAt: data.expiresAt,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      };
    }

    // Defesa contra respostas inconsistentes: mesmo que online venha true,
    // nenhum estado diferente de ATIVA pode liberar o programa.
    if (data.online === true) {
      const knownDeniedStatus = ['BLOQUEADA', 'EXPIRADA', 'SUSPENSA'].includes(licenseStatus);
      return {
        online: false,
        reason: knownDeniedStatus ? `LICENSE_STATUS_${licenseStatus}` : 'INVALID_LICENSE_STATUS',
        message: 'A licença do programa não autoriza operações online.',
        ...(licenseStatus ? { licenseStatus } : {}),
        technicalFailure: !knownDeniedStatus,
      };
    }

    return {
      online: false,
      reason: data.reason || 'NOT_AUTHORIZED',
      message: data.message || 'A licença do programa não autoriza operações online.',
      ...(licenseStatus ? { licenseStatus } : {}),
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

function credentialsIdentity(config) {
  return createHash('sha256')
    .update(config.baseUrl)
    .update('\u0000')
    .update(config.systemKey)
    .update('\u0000')
    .update(config.apiKey)
    .digest('hex');
}

async function validateNexusAccess({ now = Date.now(), fetchImpl = global.fetch, timeoutMs } = {}) {
  const config = await getNexusAuthCredentials();

  // Mantém possível o primeiro acesso do gestor para cadastrar a integração.
  if (!config) return { configured: false, online: true };

  const identity = credentialsIdentity(config);
  if (cache && cache.identity === identity && cache.expiresAt > now) {
    return { configured: true, ...cache.result };
  }

  const result = await requestNexusValidation(config, { fetchImpl, timeoutMs });
  cache = {
    identity,
    result,
    expiresAt: now + (result.online ? SUCCESS_CACHE_MS : DENIAL_CACHE_MS),
  };
  return { configured: true, ...result };
}

function clearNexusValidationCache() {
  cache = null;
}

module.exports = { requestNexusValidation, validateNexusAccess, clearNexusValidationCache };
