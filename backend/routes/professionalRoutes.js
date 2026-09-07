const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/professionalController');

const router = express.Router();

router.use(protect);
router.get('/', ctrl.listar);
router.use(authorize('gestor'));
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.remover);

module.exports = router;
