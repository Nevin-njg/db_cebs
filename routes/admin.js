const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', requireAdmin, adminController.getDashboard);
router.get('/equipment', requireAdmin, adminController.getEquipment);
router.get('/requests', requireAdmin, adminController.getRequests);
router.get('/history', requireAdmin, adminController.getHistory);
router.get('/users', requireAdmin, adminController.getUsers);

module.exports = router;