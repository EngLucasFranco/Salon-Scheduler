const { validateNexusAccess } = require('../utils/nexusValidation');

async function requireNexusOnline(req, res, next) {
  try {
    const validation = await validateNexusAccess();
    if (validation.online === true) return next();

    return res.status(validation.technicalFailure ? 503 : 403).json({
      mensagem: validation.message || 'A licença do programa não autoriza operações online.',
      online: false,
      reason: validation.reason,
      ...(validation.licenseStatus ? { licenseStatus: validation.licenseStatus } : {}),
    });
  } catch (error) {
    console.error('Falha ao validar a licença no NexusControl:', error.message);
    return res.status(503).json({
      mensagem: 'Não foi possível confirmar a licença no NexusControl.',
      online: false,
      reason: 'VALIDATION_ERROR',
    });
  }
}

module.exports = { requireNexusOnline };
