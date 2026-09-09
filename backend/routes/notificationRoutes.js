const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

const router = express.Router();
router.get('/', protect, ctrl.listar);
router.patch('/lidas', protect, ctrl.marcarComoLidas);
router.delete('/:id', protect, ctrl.remover);
module.exports = router;
