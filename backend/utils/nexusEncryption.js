const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'nexus:v1';

function encryptionKey() {
  const configured = process.env.NEXUS_CONFIG_ENCRYPTION_KEY;
  if (!configured) throw new Error('NEXUS_CONFIG_ENCRYPTION_KEY não configurada.');
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== configured.replace(/=+$/, '')) {
    throw new Error('NEXUS_CONFIG_ENCRYPTION_KEY deve conter exatamente 32 bytes em Base64.');
  }
  return key;
}

function encryptNexusValue(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('Valor do NexusControl inválido.');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptNexusValue(value) {
  const parts = typeof value === 'string' ? value.split(':') : [];
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) throw new Error('Configuração criptografada do NexusControl inválida.');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(parts[2], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[3], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encryptNexusValue, decryptNexusValue };
