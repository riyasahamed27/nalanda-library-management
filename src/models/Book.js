const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters'],
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      match: [
        /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/,
        'Please provide a valid ISBN',
      ],
    },
    publicationDate: {
      type: Date,
      required: [true, 'Publication date is required'],
    },
    genre: {
      type: String,
      required: [true, 'Genre is required'],
      trim: true,
      enum: [
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
      ],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    totalCopies: {
      type: Number,
      required: [true, 'Number of copies is required'],
      min: [0, 'Total copies cannot be negative'],
    },
    availableCopies: {
      type: Number,
      required: [true, 'Available copies is required'],
      min: [0, 'Available copies cannot be negative'],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient searching and filtering
bookSchema.index({ title: 'text', author: 'text' });
bookSchema.index({ genre: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ isbn: 1 });

// Virtual to check if book is available
bookSchema.virtual('isAvailable').get(function () {
  return this.availableCopies > 0;
});

// Virtual for borrowed count
bookSchema.virtual('borrowedCount').get(function () {
  return this.totalCopies - this.availableCopies;
});

// Pre-save middleware to ensure availableCopies doesn't exceed totalCopies
bookSchema.pre('save', function (next) {
  if (this.availableCopies > this.totalCopies) {
    this.availableCopies = this.totalCopies;
  }
  next();
});

// Static method to check availability
bookSchema.statics.isBookAvailable = async function (bookId) {
  const book = await this.findById(bookId);
  return book && book.availableCopies > 0;
};

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
