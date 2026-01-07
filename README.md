# Nalanda Library Management System

A comprehensive backend system for library management built with Node.js, Express, MongoDB, and GraphQL.

## Features

- **User Management**
  - User registration and authentication
  - JWT-based authentication with encryption layer
  - Role-based access control (Admin/Member)

- **Book Management**
  - CRUD operations for books
  - Filtering by genre, author, availability
  - Search functionality
  - Pagination support

- **Borrowing System**
  - Borrow and return books
  - Due date tracking
  - Automatic fine calculation
  - Borrowing history

- **Reports & Analytics**
  - Most borrowed books
  - Most active members
  - Book availability summary
  - Overdue reports
  - Borrowing statistics

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **API**: RESTful API + GraphQL (Apollo Server)
- **Authentication**: JWT with AES encryption
- **Validation**: express-validator

## Project Structure

```
nalanda-library-management/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── bookController.js    # Book CRUD operations
│   │   ├── borrowingController.js # Borrowing operations
│   │   └── reportController.js  # Report aggregations
│   ├── graphql/
│   │   ├── schemas/
│   │   │   └── typeDefs.js      # GraphQL type definitions
│   │   ├── resolvers/
│   │   │   └── index.js         # GraphQL resolvers
│   │   └── index.js             # Apollo Server setup
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   ├── errorHandler.js      # Error handling
│   │   ├── validate.js          # Request validation
│   │   └── index.js
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Book.js              # Book schema
│   │   ├── Borrowing.js         # Borrowing schema
│   │   └── index.js
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   ├── bookRoutes.js        # Book endpoints
│   │   ├── borrowingRoutes.js   # Borrowing endpoints
│   │   ├── reportRoutes.js      # Report endpoints
│   │   └── index.js
│   ├── utils/
│   │   └── jwt.js               # JWT utilities with encryption
│   └── server.js                # Application entry point
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nalanda-library-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your configurations:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/nalanda_library
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRES_IN=7d
   JWT_ENCRYPTION_KEY=your_32_character_encryption_key
   ```

4. **Start MongoDB**
   ```bash
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000`

## API Documentation

### REST API Endpoints

#### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get current user | Private |
| PUT | `/api/auth/profile` | Update profile | Private |
| PUT | `/api/auth/change-password` | Change password | Private |
| GET | `/api/auth/users` | Get all users | Admin |
| PUT | `/api/auth/users/:id/role` | Update user role | Admin |
| PUT | `/api/auth/users/:id/deactivate` | Deactivate user | Admin |

#### Books

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/books` | List all books (with filters) | Public |
| GET | `/api/books/:id` | Get book by ID | Public |
| GET | `/api/books/isbn/:isbn` | Get book by ISBN | Public |
| GET | `/api/books/meta/genres` | Get all genres | Public |
| POST | `/api/books` | Add new book | Admin |
| PUT | `/api/books/:id` | Update book | Admin |
| DELETE | `/api/books/:id` | Delete book (soft) | Admin |
| DELETE | `/api/books/:id/permanent` | Delete permanently | Admin |

**Query Parameters for GET /api/books:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `genre` - Filter by genre
- `author` - Filter by author (case-insensitive)
- `available` - Filter available books (true/false)
- `search` - Search in title and author
- `sortBy` - Sort field
- `sortOrder` - Sort order (asc/desc)

#### Borrowings

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/borrowings/borrow` | Borrow a book | Member |
| POST | `/api/borrowings/return/:id` | Return a book | Member |
| GET | `/api/borrowings/history` | Get borrowing history | Member |
| GET | `/api/borrowings/active` | Get active borrowings | Member |
| GET | `/api/borrowings/detail/:id` | Get borrowing details | Member |
| PUT | `/api/borrowings/:id/extend` | Extend due date | Member |
| GET | `/api/borrowings` | Get all borrowings | Admin |
| GET | `/api/borrowings/overdue` | Get overdue borrowings | Admin |

#### Reports

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/reports/most-borrowed-books` | Most borrowed books | Admin |
| GET | `/api/reports/active-members` | Most active members | Admin |
| GET | `/api/reports/book-availability` | Book availability summary | Admin |
| GET | `/api/reports/borrowing-stats` | Borrowing statistics | Admin |
| GET | `/api/reports/overdue` | Overdue report | Admin |

**Query Parameters for Reports:**
- `limit` - Number of items (default: 10)
- `period` - Time period: all, week, month, year

### GraphQL API

The GraphQL endpoint is available at `/graphql`

#### Example Queries

**Get Books with Filtering:**
```graphql
query GetBooks {
  books(
    filter: { genre: "Fiction", available: true }
    pagination: { page: 1, limit: 10 }
    sort: { field: title, order: ASC }
  ) {
    books {
      id
      title
      author
      availableCopies
      isAvailable
    }
    pagination {
      total
      pages
    }
  }
}
```

**Get Borrowing History:**
```graphql
query MyHistory {
  myBorrowingHistory(status: borrowed) {
    borrowings {
      id
      book {
        title
        author
      }
      borrowDate
      dueDate
      isOverdue
      daysRemaining
    }
  }
}
```

**Get Most Borrowed Books Report:**
```graphql
query MostBorrowed {
  mostBorrowedBooks(limit: 5, period: month) {
    period
    books {
      title
      author
      borrowCount
      uniqueBorrowerCount
    }
  }
}
```

#### Example Mutations

**Register User:**
```graphql
mutation Register {
  register(input: {
    name: "John Doe"
    email: "john@example.com"
    password: "password123"
  }) {
    token
    user {
      id
      name
      email
      role
    }
  }
}
```

**Borrow Book:**
```graphql
mutation BorrowBook {
  borrowBook(input: {
    bookId: "book_id_here"
    dueDate: "2024-02-15"
  }) {
    id
    book {
      title
    }
    dueDate
    status
  }
}
```

**Add Book (Admin):**
```graphql
mutation AddBook {
  addBook(input: {
    title: "The Great Gatsby"
    author: "F. Scott Fitzgerald"
    isbn: "978-0743273565"
    publicationDate: "1925-04-10"
    genre: "Fiction"
    description: "A novel about the American Dream"
    totalCopies: 5
  }) {
    id
    title
    availableCopies
  }
}
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_token_here>
```

The token is encrypted using AES for additional security.

### User Roles

- **Admin**: Full access to all operations
  - Manage books (add, update, delete)
  - View all users
  - Access all reports
  - Manage borrowings

- **Member**: Limited access
  - View books
  - Borrow and return books
  - View own borrowing history

## Database Schemas

### User Schema
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ['admin', 'member']),
  isActive: Boolean,
  membershipDate: Date
}
```

### Book Schema
```javascript
{
  title: String (required),
  author: String (required),
  isbn: String (required, unique),
  publicationDate: Date (required),
  genre: String (required, enum),
  description: String,
  totalCopies: Number (required),
  availableCopies: Number (required),
  addedBy: ObjectId (ref: User),
  isActive: Boolean
}
```

### Borrowing Schema
```javascript
{
  user: ObjectId (ref: User, required),
  book: ObjectId (ref: Book, required),
  borrowDate: Date,
  dueDate: Date (required),
  returnDate: Date,
  status: String (enum: ['borrowed', 'returned', 'overdue']),
  fine: Number,
  notes: String
}
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error message here",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## MongoDB Aggregations

The system uses MongoDB aggregation framework for reports:

1. **Most Borrowed Books**: Aggregates borrowing records, groups by book, and sorts by count
2. **Active Members**: Groups borrowings by user with statistics
3. **Book Availability**: Summarizes total, available, and borrowed copies
4. **Borrowing Stats**: Monthly trends, status breakdown, duration analysis
5. **Overdue Report**: Lists all overdue borrowings with fine calculations

## Security Features

1. **Password Hashing**: bcrypt with salt rounds of 12
2. **JWT Encryption**: AES encryption layer on JWT tokens
3. **Role-Based Access Control**: Middleware-based authorization
4. **Input Validation**: express-validator for request validation
5. **MongoDB Injection Prevention**: Mongoose ODM protection

## Testing

You can test the API using:

1. **GraphQL Playground**: Visit `http://localhost:3000/graphql`
2. **Postman/Insomnia**: Import the API endpoints
3. **cURL**: Command line testing

### Sample cURL Commands

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@example.com","password":"admin123","role":"admin"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

**Get Books:**
```bash
curl http://localhost:3000/api/books?genre=Fiction&available=true
```

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
