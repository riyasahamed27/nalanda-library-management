const { gql } = require('apollo-server-express');

const typeDefs = gql`
  # Scalars
  scalar Date

  # Enums
  enum Role {
    admin
    member
  }

  enum BorrowingStatus {
    borrowed
    returned
    overdue
  }

  enum Genre {
    Fiction
    NonFiction
    ScienceFiction
    Fantasy
    Mystery
    Thriller
    Romance
    Horror
    Biography
    History
    Science
    Technology
    SelfHelp
    Poetry
    Drama
    Children
    YoungAdult
    Comics
    Other
  }

  enum SortOrder {
    ASC
    DESC
  }

  enum BookSortField {
    title
    author
    publicationDate
    createdAt
  }

  enum Period {
    week
    month
    year
    all
  }

  # Input Types
  input RegisterInput {
    name: String!
    email: String!
    password: String!
    role: Role
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdateProfileInput {
    name: String
    email: String
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input BookInput {
    title: String!
    author: String!
    isbn: String!
    publicationDate: Date!
    genre: String!
    description: String
    totalCopies: Int!
  }

  input UpdateBookInput {
    title: String
    author: String
    isbn: String
    publicationDate: Date
    genre: String
    description: String
    totalCopies: Int
  }

  input BorrowBookInput {
    bookId: ID!
    dueDate: Date
  }

  input BookFilterInput {
    genre: String
    author: String
    available: Boolean
    search: String
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  input BookSortInput {
    field: BookSortField
    order: SortOrder
  }

  # Types
  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    isActive: Boolean!
    membershipDate: Date!
    createdAt: Date!
    updatedAt: Date!
    borrowings: [Borrowing]
  }

  type AuthPayload {
    user: User!
    token: String!
    refreshToken: String!
  }

  type Book {
    id: ID!
    title: String!
    author: String!
    isbn: String!
    publicationDate: Date!
    genre: String!
    description: String
    totalCopies: Int!
    availableCopies: Int!
    borrowedCount: Int!
    isAvailable: Boolean!
    isActive: Boolean!
    addedBy: User
    createdAt: Date!
    updatedAt: Date!
  }

  type Borrowing {
    id: ID!
    user: User!
    book: Book!
    borrowDate: Date!
    dueDate: Date!
    returnDate: Date
    status: BorrowingStatus!
    fine: Float!
    notes: String
    isOverdue: Boolean!
    daysRemaining: Int
    createdAt: Date!
    updatedAt: Date!
  }

  type PaginationInfo {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
  }

  type BooksResponse {
    books: [Book!]!
    pagination: PaginationInfo!
  }

  type UsersResponse {
    users: [User!]!
    pagination: PaginationInfo!
  }

  type BorrowingsResponse {
    borrowings: [Borrowing!]!
    pagination: PaginationInfo!
  }

  # Report Types
  type MostBorrowedBook {
    id: ID!
    title: String!
    author: String!
    isbn: String!
    genre: String!
    borrowCount: Int!
    uniqueBorrowerCount: Int!
    lastBorrowed: Date
  }

  type MostBorrowedBooksReport {
    period: String!
    books: [MostBorrowedBook!]!
  }

  type ActiveMember {
    id: ID!
    name: String!
    email: String!
    membershipDate: Date
    totalBorrowings: Int!
    returnedBooks: Int!
    activeBorrowings: Int!
    totalFines: Float!
    uniqueBooksCount: Int!
    lastActivity: Date
  }

  type ActiveMembersReport {
    period: String!
    members: [ActiveMember!]!
  }

  type GenreBreakdown {
    genre: String!
    bookCount: Int!
    totalCopies: Int!
    availableCopies: Int!
    borrowedCopies: Int!
  }

  type BookAvailabilitySummary {
    totalBooks: Int!
    totalCopies: Int!
    availableCopies: Int!
    borrowedCopies: Int!
    availabilityRate: Float!
  }

  type UnavailableBook {
    id: ID!
    title: String!
    author: String!
    isbn: String!
    genre: String!
    totalCopies: Int!
  }

  type BookAvailabilityReport {
    summary: BookAvailabilitySummary!
    genreBreakdown: [GenreBreakdown!]!
    unavailableBooks: [UnavailableBook!]!
  }

  type StatusBreakdown {
    status: String!
    count: Int!
  }

  type MonthlyTrend {
    year: Int!
    month: Int!
    borrowings: Int!
    returns: Int!
  }

  type BorrowingDuration {
    avgDays: Float!
    minDays: Float!
    maxDays: Float!
  }

  type BorrowingOverview {
    totalBorrowings: Int!
    thisMonth: Int!
    thisYear: Int!
    totalFinesCollected: Float!
  }

  type BorrowingStatsReport {
    overview: BorrowingOverview!
    statusBreakdown: [StatusBreakdown!]!
    monthlyTrend: [MonthlyTrend!]!
    borrowingDuration: BorrowingDuration!
  }

  type OverdueBookUser {
    id: ID!
    name: String!
    email: String!
  }

  type OverdueBookInfo {
    id: ID!
    title: String!
    author: String!
    isbn: String!
  }

  type OverdueItem {
    id: ID!
    borrowDate: Date!
    dueDate: Date!
    daysOverdue: Int!
    estimatedFine: Float!
    user: OverdueBookUser!
    book: OverdueBookInfo!
  }

  type OverdueSummary {
    totalOverdue: Int!
    totalEstimatedFines: Float!
    avgDaysOverdue: Int!
  }

  type OverdueReport {
    summary: OverdueSummary!
    overdueBooks: [OverdueItem!]!
  }

  type MessageResponse {
    success: Boolean!
    message: String!
  }

  # Queries
  type Query {
    # Auth
    me: User

    # Users (Admin only)
    users(
      role: Role
      isActive: Boolean
      pagination: PaginationInput
    ): UsersResponse!
    user(id: ID!): User

    # Books
    books(
      filter: BookFilterInput
      sort: BookSortInput
      pagination: PaginationInput
    ): BooksResponse!
    book(id: ID!): Book
    bookByISBN(isbn: String!): Book
    genres: [String!]!

    # Borrowings
    myBorrowingHistory(
      status: BorrowingStatus
      pagination: PaginationInput
    ): BorrowingsResponse!
    myActiveBorrowings: [Borrowing!]!
    borrowing(id: ID!): Borrowing

    # Admin Borrowing queries
    allBorrowings(
      status: BorrowingStatus
      userId: ID
      bookId: ID
      overdue: Boolean
      pagination: PaginationInput
    ): BorrowingsResponse!
    overdueBorrowings(pagination: PaginationInput): BorrowingsResponse!

    # Reports (Admin only)
    mostBorrowedBooks(limit: Int, period: Period): MostBorrowedBooksReport!
    activeMembers(limit: Int, period: Period): ActiveMembersReport!
    bookAvailability: BookAvailabilityReport!
    borrowingStats: BorrowingStatsReport!
    overdueReport: OverdueReport!
  }

  # Mutations
  type Mutation {
    # Auth
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    updateProfile(input: UpdateProfileInput!): User!
    changePassword(input: ChangePasswordInput!): MessageResponse!

    # User Management (Admin only)
    updateUserRole(userId: ID!, role: Role!): User!
    deactivateUser(userId: ID!): User!

    # Books (Admin only)
    addBook(input: BookInput!): Book!
    updateBook(id: ID!, input: UpdateBookInput!): Book!
    deleteBook(id: ID!): MessageResponse!
    permanentDeleteBook(id: ID!): MessageResponse!

    # Borrowings
    borrowBook(input: BorrowBookInput!): Borrowing!
    returnBook(borrowingId: ID!): Borrowing!
    extendDueDate(borrowingId: ID!, newDueDate: Date!): Borrowing!
  }
`;

module.exports = typeDefs;
