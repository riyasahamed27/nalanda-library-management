const Book = require('../models/Book');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Add a new book
 * @route   POST /api/books
 * @access  Private/Admin
 */
const addBook = asyncHandler(async (req, res) => {
  const { title, author, isbn, publicationDate, genre, description, totalCopies } = req.body;

  // Check if book with same ISBN exists
  const existingBook = await Book.findOne({ isbn });
  if (existingBook) {
    throw new ApiError(400, 'Book with this ISBN already exists');
  }

  const book = await Book.create({
    title,
    author,
    isbn,
    publicationDate,
    genre,
    description,
    totalCopies,
    availableCopies: totalCopies,
    addedBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Book added successfully',
    data: { book },
  });
});

/**
 * @desc    Get all books with pagination and filtering
 * @route   GET /api/books
 * @access  Public
 */
const getBooks = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Build query
  const query = { isActive: true };

  // Filter by genre
  if (req.query.genre) {
    query.genre = req.query.genre;
  }

  // Filter by author
  if (req.query.author) {
    query.author = { $regex: req.query.author, $options: 'i' };
  }

  // Filter by availability
  if (req.query.available === 'true') {
    query.availableCopies = { $gt: 0 };
  }

  // Search by title or author
  if (req.query.search) {
    query.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { author: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  // Sort options
  let sortOption = { createdAt: -1 };
  if (req.query.sortBy) {
    const sortField = req.query.sortBy;
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    sortOption = { [sortField]: sortOrder };
  }

  const books = await Book.find(query)
    .populate('addedBy', 'name email')
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const total = await Book.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      books,
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
 * @desc    Get single book by ID
 * @route   GET /api/books/:id
 * @access  Public
 */
const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).populate('addedBy', 'name email');

  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  res.status(200).json({
    success: true,
    data: { book },
  });
});

/**
 * @desc    Get book by ISBN
 * @route   GET /api/books/isbn/:isbn
 * @access  Public
 */
const getBookByISBN = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ isbn: req.params.isbn }).populate('addedBy', 'name email');

  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  res.status(200).json({
    success: true,
    data: { book },
  });
});

/**
 * @desc    Update book
 * @route   PUT /api/books/:id
 * @access  Private/Admin
 */
const updateBook = asyncHandler(async (req, res) => {
  const { title, author, isbn, publicationDate, genre, description, totalCopies } = req.body;

  let book = await Book.findById(req.params.id);

  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  // Check if ISBN is being changed and if it's already taken
  if (isbn && isbn !== book.isbn) {
    const existingBook = await Book.findOne({ isbn });
    if (existingBook) {
      throw new ApiError(400, 'Another book with this ISBN already exists');
    }
  }

  // Calculate new available copies if totalCopies is being updated
  let newAvailableCopies = book.availableCopies;
  if (totalCopies !== undefined) {
    const borrowedCopies = book.totalCopies - book.availableCopies;
    newAvailableCopies = Math.max(0, totalCopies - borrowedCopies);
  }

  book = await Book.findByIdAndUpdate(
    req.params.id,
    {
      title,
      author,
      isbn,
      publicationDate,
      genre,
      description,
      totalCopies,
      availableCopies: newAvailableCopies,
    },
    { new: true, runValidators: true }
  ).populate('addedBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Book updated successfully',
    data: { book },
  });
});

/**
 * @desc    Delete book (soft delete)
 * @route   DELETE /api/books/:id
 * @access  Private/Admin
 */
const deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  // Check if book has any active borrowings
  const Borrowing = require('../models/Borrowing');
  const activeBorrowings = await Borrowing.countDocuments({
    book: req.params.id,
    status: { $in: ['borrowed', 'overdue'] },
  });

  if (activeBorrowings > 0) {
    throw new ApiError(400, 'Cannot delete book with active borrowings');
  }

  // Soft delete
  await Book.findByIdAndUpdate(req.params.id, { isActive: false });

  res.status(200).json({
    success: true,
    message: 'Book deleted successfully',
  });
});

/**
 * @desc    Permanently delete book (hard delete)
 * @route   DELETE /api/books/:id/permanent
 * @access  Private/Admin
 */
const permanentDeleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  // Check if book has any borrowing records
  const Borrowing = require('../models/Borrowing');
  const borrowings = await Borrowing.countDocuments({ book: req.params.id });

  if (borrowings > 0) {
    throw new ApiError(400, 'Cannot permanently delete book with borrowing history');
  }

  await Book.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Book permanently deleted',
  });
});

/**
 * @desc    Get all genres
 * @route   GET /api/books/meta/genres
 * @access  Public
 */
const getGenres = asyncHandler(async (req, res) => {
  const genres = [
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

  res.status(200).json({
    success: true,
    data: { genres },
  });
});

module.exports = {
  addBook,
  getBooks,
  getBook,
  getBookByISBN,
  updateBook,
  deleteBook,
  permanentDeleteBook,
  getGenres,
};
