const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getMe,
  updateDetails,
  deleteUser,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', protect, getMe);
router.put('/me', protect, updateDetails);
router.delete('/me', protect, deleteUser);

module.exports = router;