const argon2 = require('argon2');
const bcrypt = require('bcryptjs');

// Perfil de 64 MiB da RFC 9106. O salt aleatório é gerado pela biblioteca.
const options = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
});

function isPasswordHash(value) {
  // Preserva também hashes legados durante a inicialização do SQLite.
  return typeof value === 'string' && /^(\$2[aby]\$|\$argon2(?:id|i|d)\$)/.test(value);
}

async function hashPassword(password) {
  if (typeof password !== 'string' || !password.length) throw new TypeError('Senha inválida.');
  return argon2.hash(password, options);
}

async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || !isPasswordHash(hash)) return false;
  try {
    if (hash.startsWith('$argon2')) return await argon2.verify(hash, password);
    // bcrypt fica disponível apenas para autenticar contas ainda não migradas.
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

function needsPasswordRehash(hash) {
  return !hash.startsWith('$argon2id$') || argon2.needsRehash(hash, options);
}

module.exports = { hashPassword, verifyPassword, isPasswordHash, needsPasswordRehash };
