const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  borrowBook,
  returnBook,
  getBorrowingHistory,
  getActiveBorrowings,
  getAllBorrowings,
  getBorrowing,
  extendDueDate,
  getOverdueBorrowings,
} = require('../controllers/borrowingController');

const { authenticate, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Validation rules
const borrowBookValidation = [
  body('bookId')
    .notEmpty()
    .withMessage('Book ID is required')
    .isMongoId()
    .withMessage('Invalid book ID'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
];

const extendDueDateValidation = [
  body('newDueDate')
    .notEmpty()
    .withMessage('New due date is required')
    .isISO8601()
    .withMessage('Please provide a valid date'),
];

// Member routes
router.post('/borrow', authenticate, borrowBookValidation, validate, borrowBook);
router.post('/return/:id', authenticate, returnBook);
router.get('/history', authenticate, getBorrowingHistory);
router.get('/active', authenticate, getActiveBorrowings);
router.get('/detail/:id', authenticate, getBorrowing);
router.put('/:id/extend', authenticate, extendDueDateValidation, validate, extendDueDate);

// Admin routes
router.get('/', authenticate, adminOnly, getAllBorrowings);
router.get('/overdue', authenticate, adminOnly, getOverdueBorrowings);

module.exports = router;
