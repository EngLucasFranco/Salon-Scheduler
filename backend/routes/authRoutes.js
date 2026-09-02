const express = require('express');
const { registrar, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/registrar', registrar);
router.post('/login', login);
router.get('/me', protect, me);

module.exports = router;
