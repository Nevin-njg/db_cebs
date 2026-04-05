const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireUser } = require('../middleware/auth');

router.get('/', requireUser, userController.getIndex);
router.post('/request', requireUser, userController.submitRequest);
router.get('/my-requests', requireUser, userController.getMyRequests); // ✅ add this

module.exports = router;