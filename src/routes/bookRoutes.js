const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const {
  addBook,
  getBooks,
  getBook,
  getBookByISBN,
  updateBook,
  deleteBook,
  permanentDeleteBook,
  getGenres,
} = require('../controllers/bookController');

const { authenticate, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ISBN regex pattern
const isbnRegex = /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/;

// Valid genres
const validGenres = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Romance',
  'Horror',
  'Biography',
  'History',
  'Science',
  'Technology',
  'Self-Help',
  'Poetry',
  'Drama',
  'Children',
  'Young Adult',
  'Comics',
  'Other',
];

// Validation rules
const addBookValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('author')
    .trim()
    .notEmpty()
    .withMessage('Author is required')
    .isLength({ max: 100 })
    .withMessage('Author name cannot exceed 100 characters'),
  body('isbn')
    .trim()
    .notEmpty()
    .withMessage('ISBN is required')
    .matches(isbnRegex)
    .withMessage('Please provide a valid ISBN'),
  body('publicationDate')
    .notEmpty()
    .withMessage('Publication date is required')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('genre')
    .trim()
    .notEmpty()
    .withMessage('Genre is required')
    .isIn(validGenres)
    .withMessage('Please provide a valid genre'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('totalCopies')
    .notEmpty()
    .withMessage('Number of copies is required')
    .isInt({ min: 1 })
    .withMessage('Number of copies must be at least 1'),
];

const updateBookValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('author')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Author name cannot exceed 100 characters'),
  body('isbn')
    .optional()
    .trim()
    .matches(isbnRegex)
    .withMessage('Please provide a valid ISBN'),
  body('publicationDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('genre')
    .optional()
    .trim()
    .isIn(validGenres)
    .withMessage('Please provide a valid genre'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('totalCopies')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Number of copies cannot be negative'),
];

// Public routes
router.get('/', getBooks);
router.get('/meta/genres', getGenres);
router.get('/isbn/:isbn', getBookByISBN);
router.get('/:id', getBook);

// Admin routes
router.post('/', authenticate, adminOnly, addBookValidation, validate, addBook);
router.put('/:id', authenticate, adminOnly, updateBookValidation, validate, updateBook);
router.delete('/:id', authenticate, adminOnly, deleteBook);
router.delete('/:id/permanent', authenticate, adminOnly, permanentDeleteBook);

module.exports = router;
