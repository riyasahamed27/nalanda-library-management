require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDatabase = require('./config/database');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { createApolloServer } = require('./graphql');

const app = express();

// Connect to MongoDB
connectDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API Routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Nalanda Library Management System API',
    version: '1.0.0',
    endpoints: {
      rest: '/api',
      graphql: '/graphql',
      health: '/api/health',
    },
    documentation: {
      rest: 'See README.md for REST API documentation',
      graphql: 'Visit /graphql for GraphQL Playground',
    },
  });
});

// Start server with GraphQL
const startServer = async () => {
  try {
    // Create Apollo Server
    const apolloServer = createApolloServer();
    await apolloServer.start();

    // Apply Apollo middleware to Express BEFORE error handlers
    apolloServer.applyMiddleware({
      app,
      path: '/graphql',
      cors: true,
    });

    // Error handling middleware (AFTER GraphQL)
    app.use(notFound);
    app.use(errorHandler);

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log('  NALANDA LIBRARY MANAGEMENT SYSTEM');
      console.log('='.repeat(50));
      console.log(`  Server running on port ${PORT}`);
      console.log(`  REST API:    http://localhost:${PORT}/api`);
      console.log(`  GraphQL:     http://localhost:${PORT}${apolloServer.graphqlPath}`);
      console.log(`  Health:      http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
