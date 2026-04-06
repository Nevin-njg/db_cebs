const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireUser } = require('../middleware/auth');

// ✅ Public route (homepage → redirect to login)
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// ✅ Protected routes
router.post('/request', requireUser, userController.submitRequest);

router.get('/my-requests', requireUser, userController.getMyRequests);

module.exports = router;