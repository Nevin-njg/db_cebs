const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireUser } = require('../middleware/auth');

// ✅ Smart homepage route (fixes redirect loop)
router.get('/', (req, res) => {
  if (req.session.user) {
    // If logged in → go to dashboard
    return userController.getIndex(req, res);
  } else {
    // If not logged in → go to login page
    return res.redirect('/auth/login');
  }
});

// ✅ Protected routes
router.post('/request', requireUser, userController.submitRequest);

router.get('/my-requests', requireUser, userController.getMyRequests);

module.exports = router;