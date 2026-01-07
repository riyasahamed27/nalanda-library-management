const Borrowing = require('../models/Borrowing');
const Book = require('../models/Book');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get most borrowed books
 * @route   GET /api/reports/most-borrowed-books
 * @access  Private/Admin
 */
const getMostBorrowedBooks = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const period = req.query.period || 'all'; // all, month, week, year

  // Build date filter based on period
  let dateFilter = {};
  const now = new Date();

  switch (period) {
    case 'week':
      dateFilter = {
        borrowDate: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      };
      break;
    case 'month':
      dateFilter = {
        borrowDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      };
      break;
    case 'year':
      dateFilter = {
        borrowDate: { $gte: new Date(now.getFullYear(), 0, 1) },
      };
      break;
    default:
      dateFilter = {};
  }

  const mostBorrowedBooks = await Borrowing.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$book',
        borrowCount: { $sum: 1 },
        uniqueBorrowers: { $addToSet: '$user' },
        lastBorrowed: { $max: '$borrowDate' },
      },
    },
    {
      $addFields: {
        uniqueBorrowerCount: { $size: '$uniqueBorrowers' },
      },
    },
    { $sort: { borrowCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'books',
        localField: '_id',
        foreignField: '_id',
        as: 'bookDetails',
      },
    },
    { $unwind: '$bookDetails' },
    {
      $project: {
        _id: 1,
        borrowCount: 1,
        uniqueBorrowerCount: 1,
        lastBorrowed: 1,
        title: '$bookDetails.title',
        author: '$bookDetails.author',
        isbn: '$bookDetails.isbn',
        genre: '$bookDetails.genre',
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      books: mostBorrowedBooks,
    },
  });
});

/**
 * @desc    Get most active members
 * @route   GET /api/reports/active-members
 * @access  Private/Admin
 */
const getActiveMembers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const period = req.query.period || 'all';

  // Build date filter based on period
  let dateFilter = {};
  const now = new Date();

  switch (period) {
    case 'week':
      dateFilter = {
        borrowDate: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      };
      break;
    case 'month':
      dateFilter = {
        borrowDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      };
      break;
    case 'year':
      dateFilter = {
        borrowDate: { $gte: new Date(now.getFullYear(), 0, 1) },
      };
      break;
    default:
      dateFilter = {};
  }

  const activeMembers = await Borrowing.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$user',
        totalBorrowings: { $sum: 1 },
        returnedBooks: {
          $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] },
        },
        activeBorrowings: {
          $sum: {
            $cond: [{ $in: ['$status', ['borrowed', 'overdue']] }, 1, 0],
          },
        },
        totalFines: { $sum: '$fine' },
        uniqueBooks: { $addToSet: '$book' },
        lastActivity: { $max: '$borrowDate' },
      },
    },
    {
      $addFields: {
        uniqueBooksCount: { $size: '$uniqueBooks' },
      },
    },
    { $sort: { totalBorrowings: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    { $unwind: '$userDetails' },
    {
      $project: {
        _id: 1,
        totalBorrowings: 1,
        returnedBooks: 1,
        activeBorrowings: 1,
        totalFines: 1,
        uniqueBooksCount: 1,
        lastActivity: 1,
        name: '$userDetails.name',
        email: '$userDetails.email',
        membershipDate: '$userDetails.membershipDate',
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      period,
      members: activeMembers,
    },
  });
});

/**
 * @desc    Get book availability summary
 * @route   GET /api/reports/book-availability
 * @access  Private/Admin
 */
const getBookAvailability = asyncHandler(async (req, res) => {
  const bookAvailability = await Book.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalBooks: { $sum: 1 },
        totalCopies: { $sum: '$totalCopies' },
        availableCopies: { $sum: '$availableCopies' },
        borrowedCopies: {
          $sum: { $subtract: ['$totalCopies', '$availableCopies'] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalBooks: 1,
        totalCopies: 1,
        availableCopies: 1,
        borrowedCopies: 1,
        availabilityRate: {
          $multiply: [
            { $divide: ['$availableCopies', '$totalCopies'] },
            100,
          ],
        },
      },
    },
  ]);

  // Genre-wise breakdown
  const genreBreakdown = await Book.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$genre',
        bookCount: { $sum: 1 },
        totalCopies: { $sum: '$totalCopies' },
        availableCopies: { $sum: '$availableCopies' },
        borrowedCopies: {
          $sum: { $subtract: ['$totalCopies', '$availableCopies'] },
        },
      },
    },
    { $sort: { bookCount: -1 } },
  ]);

  // Books with no available copies
  const unavailableBooks = await Book.find({
    isActive: true,
    availableCopies: 0,
  })
    .select('title author isbn genre totalCopies')
    .sort({ title: 1 });

  res.status(200).json({
    success: true,
    data: {
      summary: bookAvailability[0] || {
        totalBooks: 0,
        totalCopies: 0,
        availableCopies: 0,
        borrowedCopies: 0,
        availabilityRate: 0,
      },
      genreBreakdown,
      unavailableBooks,
    },
  });
});

/**
 * @desc    Get borrowing statistics
 * @route   GET /api/reports/borrowing-stats
 * @access  Private/Admin
 */
const getBorrowingStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Overall statistics
  const overallStats = await Borrowing.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ],
        thisMonth: [
          { $match: { borrowDate: { $gte: startOfMonth } } },
          { $count: 'count' },
        ],
        thisYear: [
          { $match: { borrowDate: { $gte: startOfYear } } },
          { $count: 'count' },
        ],
        totalFines: [
          {
            $group: {
              _id: null,
              total: { $sum: '$fine' },
            },
          },
        ],
      },
    },
  ]);

  // Monthly trend (last 12 months)
  const monthlyTrend = await Borrowing.aggregate([
    {
      $match: {
        borrowDate: {
          $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$borrowDate' },
          month: { $month: '$borrowDate' },
        },
        borrowings: { $sum: 1 },
        returns: {
          $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Average borrowing duration
  const avgDuration = await Borrowing.aggregate([
    { $match: { status: 'returned', returnDate: { $ne: null } } },
    {
      $project: {
        duration: {
          $divide: [
            { $subtract: ['$returnDate', '$borrowDate'] },
            1000 * 60 * 60 * 24, // Convert to days
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgDays: { $avg: '$duration' },
        minDays: { $min: '$duration' },
        maxDays: { $max: '$duration' },
      },
    },
  ]);

  const result = overallStats[0];

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalBorrowings: (result.total[0] && result.total[0].count) || 0,
        thisMonth: (result.thisMonth[0] && result.thisMonth[0].count) || 0,
        thisYear: (result.thisYear[0] && result.thisYear[0].count) || 0,
        totalFinesCollected: (result.totalFines[0] && result.totalFines[0].total) || 0,
      },
      statusBreakdown: result.byStatus,
      monthlyTrend,
      borrowingDuration: avgDuration[0] || { avgDays: 0, minDays: 0, maxDays: 0 },
    },
  });
});

/**
 * @desc    Get overdue books report
 * @route   GET /api/reports/overdue
 * @access  Private/Admin
 */
const getOverdueReport = asyncHandler(async (req, res) => {
  const overdueBooks = await Borrowing.aggregate([
    {
      $match: {
        status: { $in: ['borrowed', 'overdue'] },
        dueDate: { $lt: new Date() },
      },
    },
    {
      $addFields: {
        daysOverdue: {
          $ceil: {
            $divide: [
              { $subtract: [new Date(), '$dueDate'] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
        estimatedFine: {
          $ceil: {
            $divide: [
              { $subtract: [new Date(), '$dueDate'] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    { $unwind: '$userDetails' },
    {
      $lookup: {
        from: 'books',
        localField: 'book',
        foreignField: '_id',
        as: 'bookDetails',
      },
    },
    { $unwind: '$bookDetails' },
    {
      $project: {
        _id: 1,
        borrowDate: 1,
        dueDate: 1,
        daysOverdue: 1,
        estimatedFine: 1,
        user: {
          _id: '$userDetails._id',
          name: '$userDetails.name',
          email: '$userDetails.email',
        },
        book: {
          _id: '$bookDetails._id',
          title: '$bookDetails.title',
          author: '$bookDetails.author',
          isbn: '$bookDetails.isbn',
        },
      },
    },
    { $sort: { daysOverdue: -1 } },
  ]);

  // Summary stats
  const totalOverdue = overdueBooks.length;
  const totalEstimatedFines = overdueBooks.reduce(
    (sum, b) => sum + b.estimatedFine,
    0
  );
  const avgDaysOverdue =
    totalOverdue > 0
      ? overdueBooks.reduce((sum, b) => sum + b.daysOverdue, 0) / totalOverdue
      : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalOverdue,
        totalEstimatedFines,
        avgDaysOverdue: Math.round(avgDaysOverdue),
      },
      overdueBooks,
    },
  });
});

module.exports = {
  getMostBorrowedBooks,
  getActiveMembers,
  getBookAvailability,
  getBorrowingStats,
  getOverdueReport,
};
