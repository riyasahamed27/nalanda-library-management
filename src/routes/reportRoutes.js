const express = require('express');
const router = express.Router();

const {
  getMostBorrowedBooks,
  getActiveMembers,
  getBookAvailability,
  getBorrowingStats,
  getOverdueReport,
} = require('../controllers/reportController');

const { authenticate, adminOnly } = require('../middleware/auth');

// All report routes are admin only
router.use(authenticate, adminOnly);

router.get('/most-borrowed-books', getMostBorrowedBooks);
router.get('/active-members', getActiveMembers);
router.get('/book-availability', getBookAvailability);
router.get('/borrowing-stats', getBorrowingStats);
router.get('/overdue', getOverdueReport);

module.exports = router;
