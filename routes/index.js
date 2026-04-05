const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireUser } = require('../middleware/auth');

router.get('/', requireUser, userController.getIndex);
router.post('/request', requireUser, userController.submitRequest);

module.exports = router;