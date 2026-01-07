const { GraphQLScalarType, Kind } = require('graphql');
const { AuthenticationError, ForbiddenError, UserInputError } = require('apollo-server-express');

const User = require('../../models/User');
const Book = require('../../models/Book');
const Borrowing = require('../../models/Borrowing');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');

// Custom Date scalar
const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

// Helper functions
const checkAuth = (context) => {
  if (!context.user) {
    throw new AuthenticationError('You must be logged in');
  }
  return context.user;
};

const checkAdmin = (context) => {
  const user = checkAuth(context);
  if (user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  return user;
};

const resolvers = {
  Date: dateScalar,

  // Field resolvers
  User: {
    borrowings: async (parent) => {
      return Borrowing.find({ user: parent._id }).populate('book');
    },
  },

  Book: {
    addedBy: async (parent) => {
      return User.findById(parent.addedBy);
    },
    borrowedCount: (parent) => parent.totalCopies - parent.availableCopies,
    isAvailable: (parent) => parent.availableCopies > 0,
  },

  Borrowing: {
    user: async (parent) => {
      if (parent.user && typeof parent.user === 'object' && parent.user.name) {
        return parent.user;
      }
      return User.findById(parent.user);
    },
    book: async (parent) => {
      if (parent.book && typeof parent.book === 'object' && parent.book.title) {
        return parent.book;
      }
      return Book.findById(parent.book);
    },
    isOverdue: (parent) => {
      if (parent.status === 'returned') return false;
      return new Date() > parent.dueDate;
    },
    daysRemaining: (parent) => {
      if (parent.status === 'returned') return null;
      const diff = parent.dueDate - new Date();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },
  },

  Query: {
    // Auth
    me: async (_, __, context) => {
      const user = checkAuth(context);
      return User.findById(user._id);
    },

    // Users
    users: async (_, { role, isActive, pagination = {} }, context) => {
      checkAdmin(context);
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = {};
      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive;

      const [users, total] = await Promise.all([
        User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        User.countDocuments(query),
      ]);

      return {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    user: async (_, { id }, context) => {
      checkAdmin(context);
      return User.findById(id);
    },

    // Books
    books: async (_, { filter = {}, sort = {}, pagination = {} }) => {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = { isActive: true };
      if (filter.genre) query.genre = filter.genre;
      if (filter.author) query.author = { $regex: filter.author, $options: 'i' };
      if (filter.available === true) query.availableCopies = { $gt: 0 };
      if (filter.search) {
        query.$or = [
          { title: { $regex: filter.search, $options: 'i' } },
          { author: { $regex: filter.search, $options: 'i' } },
        ];
      }

      const sortOption = {};
      if (sort.field) {
        sortOption[sort.field] = sort.order === 'ASC' ? 1 : -1;
      } else {
        sortOption.createdAt = -1;
      }

      const [books, total] = await Promise.all([
        Book.find(query).sort(sortOption).skip(skip).limit(limit),
        Book.countDocuments(query),
      ]);

      return {
        books,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    book: async (_, { id }) => {
      return Book.findById(id);
    },

    bookByISBN: async (_, { isbn }) => {
      return Book.findOne({ isbn });
    },

    genres: () => [
      'Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery',
      'Thriller', 'Romance', 'Horror', 'Biography', 'History', 'Science',
      'Technology', 'Self-Help', 'Poetry', 'Drama', 'Children', 'Young Adult',
      'Comics', 'Other',
    ],

    // Borrowings
    myBorrowingHistory: async (_, { status, pagination = {} }, context) => {
      const user = checkAuth(context);
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = { user: user._id };
      if (status) query.status = status;

      const [borrowings, total] = await Promise.all([
        Borrowing.find(query)
          .populate('book')
          .sort({ borrowDate: -1 })
          .skip(skip)
          .limit(limit),
        Borrowing.countDocuments(query),
      ]);

      return {
        borrowings,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    myActiveBorrowings: async (_, __, context) => {
      const user = checkAuth(context);
      return Borrowing.getActiveBorrowings(user._id);
    },

    borrowing: async (_, { id }, context) => {
      const user = checkAuth(context);
      const borrowing = await Borrowing.findById(id).populate('user book');

      if (!borrowing) {
        throw new UserInputError('Borrowing not found');
      }

      if (borrowing.user._id.toString() !== user._id.toString() && user.role !== 'admin') {
        throw new ForbiddenError('Not authorized');
      }

      return borrowing;
    },

    allBorrowings: async (_, { status, userId, bookId, overdue, pagination = {} }, context) => {
      checkAdmin(context);
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = {};
      if (status) query.status = status;
      if (userId) query.user = userId;
      if (bookId) query.book = bookId;
      if (overdue) {
        query.status = { $in: ['borrowed', 'overdue'] };
        query.dueDate = { $lt: new Date() };
      }

      const [borrowings, total] = await Promise.all([
        Borrowing.find(query)
          .populate('user book')
          .sort({ borrowDate: -1 })
          .skip(skip)
          .limit(limit),
        Borrowing.countDocuments(query),
      ]);

      return {
        borrowings,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    overdueBorrowings: async (_, { pagination = {} }, context) => {
      checkAdmin(context);
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query = {
        status: { $in: ['borrowed', 'overdue'] },
        dueDate: { $lt: new Date() },
      };

      const [borrowings, total] = await Promise.all([
        Borrowing.find(query)
          .populate('user book')
          .sort({ dueDate: 1 })
          .skip(skip)
          .limit(limit),
        Borrowing.countDocuments(query),
      ]);

      return {
        borrowings,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    // Reports
    mostBorrowedBooks: async (_, { limit = 10, period = 'all' }, context) => {
      checkAdmin(context);

      let dateFilter = {};
      const now = new Date();

      switch (period) {
        case 'week':
          dateFilter = { borrowDate: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
          break;
        case 'month':
          dateFilter = { borrowDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
          break;
        case 'year':
          dateFilter = { borrowDate: { $gte: new Date(now.getFullYear(), 0, 1) } };
          break;
      }

      const books = await Borrowing.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$book',
            borrowCount: { $sum: 1 },
            uniqueBorrowers: { $addToSet: '$user' },
            lastBorrowed: { $max: '$borrowDate' },
          },
        },
        { $addFields: { uniqueBorrowerCount: { $size: '$uniqueBorrowers' } } },
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
            id: '$_id',
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

      return { period, books };
    },

    activeMembers: async (_, { limit = 10, period = 'all' }, context) => {
      checkAdmin(context);

      let dateFilter = {};
      const now = new Date();

      switch (period) {
        case 'week':
          dateFilter = { borrowDate: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
          break;
        case 'month':
          dateFilter = { borrowDate: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
          break;
        case 'year':
          dateFilter = { borrowDate: { $gte: new Date(now.getFullYear(), 0, 1) } };
          break;
      }

      const members = await Borrowing.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$user',
            totalBorrowings: { $sum: 1 },
            returnedBooks: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            activeBorrowings: { $sum: { $cond: [{ $in: ['$status', ['borrowed', 'overdue']] }, 1, 0] } },
            totalFines: { $sum: '$fine' },
            uniqueBooks: { $addToSet: '$book' },
            lastActivity: { $max: '$borrowDate' },
          },
        },
        { $addFields: { uniqueBooksCount: { $size: '$uniqueBooks' } } },
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
            id: '$_id',
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

      return { period, members };
    },

    bookAvailability: async (_, __, context) => {
      checkAdmin(context);

      const [summaryResult, genreBreakdown, unavailableBooks] = await Promise.all([
        Book.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              totalBooks: { $sum: 1 },
              totalCopies: { $sum: '$totalCopies' },
              availableCopies: { $sum: '$availableCopies' },
              borrowedCopies: { $sum: { $subtract: ['$totalCopies', '$availableCopies'] } },
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
                $multiply: [{ $divide: ['$availableCopies', '$totalCopies'] }, 100],
              },
            },
          },
        ]),
        Book.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$genre',
              bookCount: { $sum: 1 },
              totalCopies: { $sum: '$totalCopies' },
              availableCopies: { $sum: '$availableCopies' },
              borrowedCopies: { $sum: { $subtract: ['$totalCopies', '$availableCopies'] } },
            },
          },
          { $sort: { bookCount: -1 } },
          { $project: { genre: '$_id', bookCount: 1, totalCopies: 1, availableCopies: 1, borrowedCopies: 1, _id: 0 } },
        ]),
        Book.find({ isActive: true, availableCopies: 0 })
          .select('title author isbn genre totalCopies')
          .sort({ title: 1 }),
      ]);

      return {
        summary: summaryResult[0] || {
          totalBooks: 0,
          totalCopies: 0,
          availableCopies: 0,
          borrowedCopies: 0,
          availabilityRate: 0,
        },
        genreBreakdown,
        unavailableBooks: unavailableBooks.map((b) => ({
          id: b._id,
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          genre: b.genre,
          totalCopies: b.totalCopies,
        })),
      };
    },

    borrowingStats: async (_, __, context) => {
      checkAdmin(context);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [overallStats, monthlyTrend, avgDuration] = await Promise.all([
        Borrowing.aggregate([
          {
            $facet: {
              total: [{ $count: 'count' }],
              byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
              thisMonth: [{ $match: { borrowDate: { $gte: startOfMonth } } }, { $count: 'count' }],
              thisYear: [{ $match: { borrowDate: { $gte: startOfYear } } }, { $count: 'count' }],
              totalFines: [{ $group: { _id: null, total: { $sum: '$fine' } } }],
            },
          },
        ]),
        Borrowing.aggregate([
          { $match: { borrowDate: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
          {
            $group: {
              _id: { year: { $year: '$borrowDate' }, month: { $month: '$borrowDate' } },
              borrowings: { $sum: 1 },
              returns: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          { $project: { year: '$_id.year', month: '$_id.month', borrowings: 1, returns: 1, _id: 0 } },
        ]),
        Borrowing.aggregate([
          { $match: { status: 'returned', returnDate: { $ne: null } } },
          {
            $project: {
              duration: { $divide: [{ $subtract: ['$returnDate', '$borrowDate'] }, 1000 * 60 * 60 * 24] },
            },
          },
          { $group: { _id: null, avgDays: { $avg: '$duration' }, minDays: { $min: '$duration' }, maxDays: { $max: '$duration' } } },
        ]),
      ]);

      const result = overallStats[0];

      return {
        overview: {
          totalBorrowings: (result.total[0] && result.total[0].count) || 0,
          thisMonth: (result.thisMonth[0] && result.thisMonth[0].count) || 0,
          thisYear: (result.thisYear[0] && result.thisYear[0].count) || 0,
          totalFinesCollected: (result.totalFines[0] && result.totalFines[0].total) || 0,
        },
        statusBreakdown: result.byStatus.map((s) => ({ status: s._id, count: s.count })),
        monthlyTrend,
        borrowingDuration: avgDuration[0] || { avgDays: 0, minDays: 0, maxDays: 0 },
      };
    },

    overdueReport: async (_, __, context) => {
      checkAdmin(context);

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
              $ceil: { $divide: [{ $subtract: [new Date(), '$dueDate'] }, 1000 * 60 * 60 * 24] },
            },
            estimatedFine: {
              $ceil: { $divide: [{ $subtract: [new Date(), '$dueDate'] }, 1000 * 60 * 60 * 24] },
            },
          },
        },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
        { $unwind: '$userDetails' },
        { $lookup: { from: 'books', localField: 'book', foreignField: '_id', as: 'bookDetails' } },
        { $unwind: '$bookDetails' },
        {
          $project: {
            id: '$_id',
            borrowDate: 1,
            dueDate: 1,
            daysOverdue: 1,
            estimatedFine: 1,
            user: { id: '$userDetails._id', name: '$userDetails.name', email: '$userDetails.email' },
            book: { id: '$bookDetails._id', title: '$bookDetails.title', author: '$bookDetails.author', isbn: '$bookDetails.isbn' },
          },
        },
        { $sort: { daysOverdue: -1 } },
      ]);

      const totalOverdue = overdueBooks.length;
      const totalEstimatedFines = overdueBooks.reduce((sum, b) => sum + b.estimatedFine, 0);
      const avgDaysOverdue = totalOverdue > 0
        ? Math.round(overdueBooks.reduce((sum, b) => sum + b.daysOverdue, 0) / totalOverdue)
        : 0;

      return {
        summary: { totalOverdue, totalEstimatedFines, avgDaysOverdue },
        overdueBooks,
      };
    },
  },

  Mutation: {
    // Auth
    register: async (_, { input }) => {
      const { name, email, password, role } = input;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new UserInputError('User with this email already exists');
      }

      const user = await User.create({
        name,
        email,
        password,
        role: role || 'member',
      });

      const token = generateToken({ userId: user._id, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user._id });

      return { user: user.toPublicProfile(), token, refreshToken };
    },

    login: async (_, { input }) => {
      const { email, password } = input;

      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      if (!user.isActive) {
        throw new AuthenticationError('Account deactivated');
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new AuthenticationError('Invalid email or password');
      }

      const token = generateToken({ userId: user._id, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user._id });

      return { user: user.toPublicProfile(), token, refreshToken };
    },

    updateProfile: async (_, { input }, context) => {
      const user = checkAuth(context);

      if (input.email && input.email !== user.email) {
        const existing = await User.findOne({ email: input.email });
        if (existing) {
          throw new UserInputError('Email already in use');
        }
      }

      const updated = await User.findByIdAndUpdate(user._id, input, {
        new: true,
        runValidators: true,
      });

      return updated;
    },

    changePassword: async (_, { input }, context) => {
      const user = checkAuth(context);
      const { currentPassword, newPassword } = input;

      const userWithPassword = await User.findById(user._id).select('+password');
      const isMatch = await userWithPassword.comparePassword(currentPassword);

      if (!isMatch) {
        throw new UserInputError('Current password is incorrect');
      }

      userWithPassword.password = newPassword;
      await userWithPassword.save();

      return { success: true, message: 'Password changed successfully' };
    },

    // User Management
    updateUserRole: async (_, { userId, role }, context) => {
      checkAdmin(context);

      const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
      if (!user) {
        throw new UserInputError('User not found');
      }

      return user;
    },

    deactivateUser: async (_, { userId }, context) => {
      checkAdmin(context);

      const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true });
      if (!user) {
        throw new UserInputError('User not found');
      }

      return user;
    },

    // Books
    addBook: async (_, { input }, context) => {
      checkAdmin(context);

      const existing = await Book.findOne({ isbn: input.isbn });
      if (existing) {
        throw new UserInputError('Book with this ISBN already exists');
      }

      const book = await Book.create({
        ...input,
        availableCopies: input.totalCopies,
        addedBy: context.user._id,
      });

      return book;
    },

    updateBook: async (_, { id, input }, context) => {
      checkAdmin(context);

      let book = await Book.findById(id);
      if (!book) {
        throw new UserInputError('Book not found');
      }

      if (input.isbn && input.isbn !== book.isbn) {
        const existing = await Book.findOne({ isbn: input.isbn });
        if (existing) {
          throw new UserInputError('Another book with this ISBN exists');
        }
      }

      let newAvailableCopies = book.availableCopies;
      if (input.totalCopies !== undefined) {
        const borrowed = book.totalCopies - book.availableCopies;
        newAvailableCopies = Math.max(0, input.totalCopies - borrowed);
      }

      book = await Book.findByIdAndUpdate(
        id,
        { ...input, availableCopies: newAvailableCopies },
        { new: true, runValidators: true }
      );

      return book;
    },

    deleteBook: async (_, { id }, context) => {
      checkAdmin(context);

      const book = await Book.findById(id);
      if (!book) {
        throw new UserInputError('Book not found');
      }

      const activeBorrowings = await Borrowing.countDocuments({
        book: id,
        status: { $in: ['borrowed', 'overdue'] },
      });

      if (activeBorrowings > 0) {
        throw new UserInputError('Cannot delete book with active borrowings');
      }

      await Book.findByIdAndUpdate(id, { isActive: false });

      return { success: true, message: 'Book deleted successfully' };
    },

    permanentDeleteBook: async (_, { id }, context) => {
      checkAdmin(context);

      const book = await Book.findById(id);
      if (!book) {
        throw new UserInputError('Book not found');
      }

      const borrowings = await Borrowing.countDocuments({ book: id });
      if (borrowings > 0) {
        throw new UserInputError('Cannot permanently delete book with borrowing history');
      }

      await Book.findByIdAndDelete(id);

      return { success: true, message: 'Book permanently deleted' };
    },

    // Borrowings
    borrowBook: async (_, { input }, context) => {
      const user = checkAuth(context);
      const { bookId, dueDate } = input;

      const book = await Book.findById(bookId);
      if (!book || !book.isActive) {
        throw new UserInputError('Book not found or unavailable');
      }

      if (book.availableCopies <= 0) {
        throw new UserInputError('No copies available');
      }

      const hasActive = await Borrowing.hasActiveBorrowing(user._id, bookId);
      if (hasActive) {
        throw new UserInputError('You already have this book borrowed');
      }

      const borrowDueDate = dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      if (new Date(borrowDueDate) <= new Date()) {
        throw new UserInputError('Due date must be in the future');
      }

      const borrowing = await Borrowing.create({
        user: user._id,
        book: bookId,
        dueDate: borrowDueDate,
      });

      await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: -1 } });

      return Borrowing.findById(borrowing._id).populate('book user');
    },

    returnBook: async (_, { borrowingId }, context) => {
      const user = checkAuth(context);

      const borrowing = await Borrowing.findById(borrowingId).populate('book');
      if (!borrowing) {
        throw new UserInputError('Borrowing not found');
      }

      if (borrowing.user.toString() !== user._id.toString() && user.role !== 'admin') {
        throw new ForbiddenError('Not authorized');
      }

      if (borrowing.status === 'returned') {
        throw new UserInputError('Book already returned');
      }

      const returnDate = new Date();
      const fine = Borrowing.calculateFine(borrowing.dueDate, returnDate);

      borrowing.returnDate = returnDate;
      borrowing.status = 'returned';
      borrowing.fine = fine;
      await borrowing.save();

      await Book.findByIdAndUpdate(borrowing.book._id, { $inc: { availableCopies: 1 } });

      return Borrowing.findById(borrowingId).populate('book user');
    },

    extendDueDate: async (_, { borrowingId, newDueDate }, context) => {
      const user = checkAuth(context);

      const borrowing = await Borrowing.findById(borrowingId);
      if (!borrowing) {
        throw new UserInputError('Borrowing not found');
      }

      if (borrowing.user.toString() !== user._id.toString() && user.role !== 'admin') {
        throw new ForbiddenError('Not authorized');
      }

      if (borrowing.status === 'returned') {
        throw new UserInputError('Cannot extend returned books');
      }

      const parsedDate = new Date(newDueDate);
      if (parsedDate <= borrowing.dueDate) {
        throw new UserInputError('New due date must be after current due date');
      }

      const maxExtension = new Date(borrowing.dueDate);
      maxExtension.setDate(maxExtension.getDate() + 30);
      if (parsedDate > maxExtension) {
        throw new UserInputError('Cannot extend more than 30 days');
      }

      borrowing.dueDate = parsedDate;
      if (borrowing.status === 'overdue') {
        borrowing.status = 'borrowed';
      }
      await borrowing.save();

      return Borrowing.findById(borrowingId).populate('book user');
    },
  },
};

module.exports = resolvers;
