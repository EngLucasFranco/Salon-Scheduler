const jwt = require('jsonwebtoken');
const { findUserById, safeUser } = require('../config/store');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ mensagem: 'Não autorizado. Faça login novamente.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await findUserById(payload.id);

    if (!usuario) {
      return res.status(401).json({ mensagem: 'Usuário não encontrado.' });
    }

    req.usuario = safeUser(usuario);
    next();
  } catch (erro) {
    return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
  }
}

// Uso: authorize('gestor') ou authorize('gestor', 'cliente')
function authorize(...papeisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !papeisPermitidos.includes(req.usuario.papel)) {
      return res.status(403).json({ mensagem: 'Você não tem permissão para esta ação.' });
    }
    next();
  };
}

module.exports = { protect, authorize };
