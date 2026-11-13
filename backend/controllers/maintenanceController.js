const { timingSafeEqual } = require('node:crypto');
const connectDB = require('../config/db');

function secretsMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function createDatabaseKeepaliveHandler({
  connect = connectDB,
  getSecret = () => process.env.KEEPALIVE_SECRET,
  now = () => new Date(),
} = {}) {
  return async function databaseKeepalive(req, res) {
    const configuredSecret = getSecret();

    if (!configuredSecret) {
      return res.status(503).json({
        success: false,
        message: 'Keep-alive não configurado no servidor.',
      });
    }

    if (!secretsMatch(req.get('x-keepalive-key'), configuredSecret)) {
      return res.status(401).json({
        success: false,
        message: 'Chave de keep-alive inválida.',
      });
    }

    try {
      const mongooseInstance = await connect();
      await mongooseInstance.connection.db.admin().ping();

      return res.status(200).json({
        success: true,
        message: 'MongoDB keep-alive executado.',
        checkedAt: now().toISOString(),
      });
    } catch (_error) {
      console.error('Falha ao executar o keep-alive do MongoDB.');
      return res.status(503).json({
        success: false,
        message: 'Não foi possível confirmar a conexão com o MongoDB.',
      });
    }
  };
}

module.exports = {
  createDatabaseKeepaliveHandler,
  databaseKeepalive: createDatabaseKeepaliveHandler(),
};
