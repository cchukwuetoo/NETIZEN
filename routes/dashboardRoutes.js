const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const  dashboardController  = require('../controllers/dashboardController');


// Protected dashboard routes - all require authentication
router.get('/home', protect, dashboardController.getHomePage);
router.get('/search', protect, dashboardController.getSearchPage);
router.get('/inbox', protect, dashboardController.getInbox);
router.get('/for-you', protect, dashboardController.getForYouContent);
router.get('/live', protect, dashboardController.getLiveContent);

module.exports = router;