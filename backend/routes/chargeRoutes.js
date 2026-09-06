const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/chargeController');

const router = express.Router();
router.use(protect, authorize('gestor'));
router.get('/atendimentos', ctrl.atendimentosDoDia);
router.get('/', ctrl.listar);
router.post('/', ctrl.criar);
module.exports = router;
