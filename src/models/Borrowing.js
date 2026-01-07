const mongoose = require('mongoose');

const borrowingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book is required'],
    },
    borrowDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    returnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['borrowed', 'returned', 'overdue'],
      default: 'borrowed',
    },
    fine: {
      type: Number,
      default: 0,
      min: [0, 'Fine cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for efficient queries
borrowingSchema.index({ user: 1, status: 1 });
borrowingSchema.index({ book: 1, status: 1 });
borrowingSchema.index({ borrowDate: -1 });
borrowingSchema.index({ dueDate: 1, status: 1 });

// Virtual to check if overdue
borrowingSchema.virtual('isOverdue').get(function () {
  if (this.status === 'returned') return false;
  return new Date() > this.dueDate;
});

// Virtual to get days until due or days overdue
borrowingSchema.virtual('daysRemaining').get(function () {
  if (this.status === 'returned') return null;
  const now = new Date();
  const diff = this.dueDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update status if overdue
borrowingSchema.pre('save', function (next) {
  if (this.status !== 'returned' && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  next();
});

// Static method to get user's active borrowings
borrowingSchema.statics.getActiveBorrowings = async function (userId) {
  return this.find({
    user: userId,
    status: { $in: ['borrowed', 'overdue'] },
  }).populate('book');
};

// Static method to check if user has already borrowed this book
borrowingSchema.statics.hasActiveBorrowing = async function (userId, bookId) {
  const borrowing = await this.findOne({
    user: userId,
    book: bookId,
    status: { $in: ['borrowed', 'overdue'] },
  });
  return !!borrowing;
};

// Static method to calculate fine (Rs. 1 per day overdue)
borrowingSchema.statics.calculateFine = function (dueDate, returnDate = new Date()) {
  if (returnDate <= dueDate) return 0;
  const daysOverdue = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
  return daysOverdue * 1; // Rs. 1 per day
};

const Borrowing = mongoose.model('Borrowing', borrowingSchema);

module.exports = Borrowing;
