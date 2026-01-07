const Borrowing = require('../models/Borrowing');
const Book = require('../models/Book');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Borrow a book
 * @route   POST /api/borrowings/borrow
 * @access  Private/Member
 */
const borrowBook = asyncHandler(async (req, res) => {
  const { bookId, dueDate } = req.body;

  // Check if book exists
  const book = await Book.findById(bookId);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  // Check if book is active
  if (!book.isActive) {
    throw new ApiError(400, 'This book is not available in the library');
  }

  // Check if book is available
  if (book.availableCopies <= 0) {
    throw new ApiError(400, 'No copies available for borrowing');
  }

  // Check if user already has this book borrowed
  const existingBorrowing = await Borrowing.hasActiveBorrowing(req.user._id, bookId);
  if (existingBorrowing) {
    throw new ApiError(400, 'You already have this book borrowed');
  }

  // Set due date (default 14 days if not provided)
  const borrowDueDate = dueDate
    ? new Date(dueDate)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Validate due date is in the future
  if (borrowDueDate <= new Date()) {
    throw new ApiError(400, 'Due date must be in the future');
  }

  // Create borrowing record
  const borrowing = await Borrowing.create({
    user: req.user._id,
    book: bookId,
    dueDate: borrowDueDate,
  });

  // Update book available copies
  await Book.findByIdAndUpdate(bookId, {
    $inc: { availableCopies: -1 },
  });

  // Populate book details
  await borrowing.populate('book', 'title author isbn');

  res.status(201).json({
    success: true,
    message: 'Book borrowed successfully',
    data: { borrowing },
  });
});

/**
 * @desc    Return a book
 * @route   POST /api/borrowings/return/:id
 * @access  Private/Member
 */
const returnBook = asyncHandler(async (req, res) => {
  const borrowing = await Borrowing.findById(req.params.id).populate('book');

  if (!borrowing) {
    throw new ApiError(404, 'Borrowing record not found');
  }

  // Check if user owns this borrowing (or is admin)
  if (borrowing.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to return this book');
  }

  // Check if already returned
  if (borrowing.status === 'returned') {
    throw new ApiError(400, 'Book has already been returned');
  }

  // Calculate fine if overdue
  const returnDate = new Date();
  const fine = Borrowing.calculateFine(borrowing.dueDate, returnDate);

  // Update borrowing record
  borrowing.returnDate = returnDate;
  borrowing.status = 'returned';
  borrowing.fine = fine;
  await borrowing.save();

  // Update book available copies
  await Book.findByIdAndUpdate(borrowing.book._id, {
    $inc: { availableCopies: 1 },
  });

  res.status(200).json({
    success: true,
    message: fine > 0
      ? `Book returned successfully. Fine: Rs. ${fine}`
      : 'Book returned successfully',
    data: { borrowing },
  });
});

/**
 * @desc    Get user's borrowing history
 * @route   GET /api/borrowings/history
 * @access  Private
 */
const getBorrowingHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Build query
  const query = { user: req.user._id };

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  const borrowings = await Borrowing.find(query)
    .populate('book', 'title author isbn genre')
    .sort({ borrowDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Borrowing.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      borrowings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * @desc    Get user's active borrowings
 * @route   GET /api/borrowings/active
 * @access  Private
 */
const getActiveBorrowings = asyncHandler(async (req, res) => {
  const borrowings = await Borrowing.getActiveBorrowings(req.user._id);

  res.status(200).json({
    success: true,
    data: { borrowings },
  });
});

/**
 * @desc    Get all borrowings (Admin only)
 * @route   GET /api/borrowings
 * @access  Private/Admin
 */
const getAllBorrowings = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by user
  if (req.query.userId) {
    query.user = req.query.userId;
  }

  // Filter by book
  if (req.query.bookId) {
    query.book = req.query.bookId;
  }

  // Filter overdue
  if (req.query.overdue === 'true') {
    query.status = { $in: ['borrowed', 'overdue'] };
    query.dueDate = { $lt: new Date() };
  }

  const borrowings = await Borrowing.find(query)
    .populate('user', 'name email')
    .populate('book', 'title author isbn')
    .sort({ borrowDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Borrowing.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      borrowings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * @desc    Get borrowing by ID
 * @route   GET /api/borrowings/:id
 * @access  Private
 */
const getBorrowing = asyncHandler(async (req, res) => {
  const borrowing = await Borrowing.findById(req.params.id)
    .populate('user', 'name email')
    .populate('book', 'title author isbn genre');

  if (!borrowing) {
    throw new ApiError(404, 'Borrowing record not found');
  }

  // Check if user owns this borrowing (or is admin)
  if (borrowing.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this borrowing record');
  }

  res.status(200).json({
    success: true,
    data: { borrowing },
  });
});

/**
 * @desc    Extend due date
 * @route   PUT /api/borrowings/:id/extend
 * @access  Private
 */
const extendDueDate = asyncHandler(async (req, res) => {
  const { newDueDate } = req.body;

  const borrowing = await Borrowing.findById(req.params.id);

  if (!borrowing) {
    throw new ApiError(404, 'Borrowing record not found');
  }

  // Check if user owns this borrowing (or is admin)
  if (borrowing.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to extend this borrowing');
  }

  // Check if already returned
  if (borrowing.status === 'returned') {
    throw new ApiError(400, 'Cannot extend returned books');
  }

  // Validate new due date
  const parsedNewDueDate = new Date(newDueDate);
  if (parsedNewDueDate <= borrowing.dueDate) {
    throw new ApiError(400, 'New due date must be after current due date');
  }

  // Max extension: 30 days from original due date
  const maxExtension = new Date(borrowing.dueDate);
  maxExtension.setDate(maxExtension.getDate() + 30);
  if (parsedNewDueDate > maxExtension) {
    throw new ApiError(400, 'Cannot extend more than 30 days from original due date');
  }

  borrowing.dueDate = parsedNewDueDate;
  if (borrowing.status === 'overdue') {
    borrowing.status = 'borrowed';
  }
  await borrowing.save();

  await borrowing.populate('book', 'title author isbn');

  res.status(200).json({
    success: true,
    message: 'Due date extended successfully',
    data: { borrowing },
  });
});

/**
 * @desc    Get overdue borrowings
 * @route   GET /api/borrowings/overdue
 * @access  Private/Admin
 */
const getOverdueBorrowings = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = {
    status: { $in: ['borrowed', 'overdue'] },
    dueDate: { $lt: new Date() },
  };

  const borrowings = await Borrowing.find(query)
    .populate('user', 'name email')
    .populate('book', 'title author isbn')
    .sort({ dueDate: 1 })
    .skip(skip)
    .limit(limit);

  // Update status to overdue for found records
  await Borrowing.updateMany(query, { status: 'overdue' });

  const total = await Borrowing.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      borrowings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

module.exports = {
  borrowBook,
  returnBook,
  getBorrowingHistory,
  getActiveBorrowings,
  getAllBorrowings,
  getBorrowing,
  extendDueDate,
  getOverdueBorrowings,
};
