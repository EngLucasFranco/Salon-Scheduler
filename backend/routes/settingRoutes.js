const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/settingController');

const router = express.Router();
router.get('/layout', ctrl.obterLayouts);
router.put('/layout', protect, authorize('gestor'), ctrl.atualizarLayouts);
module.exports = router;
