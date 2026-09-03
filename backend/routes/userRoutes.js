const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const router = express.Router();

router.use(protect, authorize('gestor'));
router.get('/', ctrl.listar);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.delete('/:id', ctrl.remover);

module.exports = router;
