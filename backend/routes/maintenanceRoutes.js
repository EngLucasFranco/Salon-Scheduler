const express = require('express');
const { databaseKeepalive } = require('../controllers/maintenanceController');

const router = express.Router();

router.post('/database-keepalive', databaseKeepalive);

module.exports = router;
