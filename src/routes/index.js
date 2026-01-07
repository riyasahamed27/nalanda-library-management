const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const bookRoutes = require('./bookRoutes');
const borrowingRoutes = require('./borrowingRoutes');
const reportRoutes = require('./reportRoutes');

// API routes
router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/borrowings', borrowingRoutes);
router.use('/reports', reportRoutes);

// API root endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nalanda Library Management System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      books: '/api/books',
      borrowings: '/api/borrowings',
      reports: '/api/reports',
      health: '/api/health',
    },
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nalanda Library Management System API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
