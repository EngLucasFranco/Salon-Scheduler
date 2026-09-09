const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/settingController');

const router = express.Router();
router.get('/layout', ctrl.obterLayouts);
router.put('/layout', protect, authorize('gestor'), ctrl.atualizarLayouts);
router.get('/geral', ctrl.obterConfiguracoesGerais);
router.put('/geral', protect, authorize('gestor'), ctrl.atualizarConfiguracoesGerais);
router.get('/notificacoes', protect, authorize('gestor'), ctrl.obterConfiguracoesNotificacao);
router.put('/notificacoes', protect, authorize('gestor'), ctrl.atualizarConfiguracoesNotificacao);
module.exports = router;
