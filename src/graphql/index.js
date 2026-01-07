const { ApolloServer } = require('apollo-server-express');
const typeDefs = require('./schemas/typeDefs');
const resolvers = require('./resolvers');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Create and configure Apollo Server
 */
const createApolloServer = () => {
  return new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      // Get token from header
      const authHeader = req.headers.authorization || '';

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        try {
          const decoded = verifyToken(token);
          const user = await User.findById(decoded.userId).select('-password');

          if (user && user.isActive) {
            return { user };
          }
        } catch (error) {
          // Token invalid or expired, user will be null
          console.log('GraphQL Auth Error:', error.message);
        }
      }

      return { user: null };
    },
    formatError: (error) => {
      // Log error for debugging
      console.error('GraphQL Error:', error);

      // Return sanitized error for production
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
        extensions: {
          code: (error.extensions && error.extensions.code) || 'INTERNAL_SERVER_ERROR',
        },
      };
    },
    introspection: true, // Enable introspection for development/testing
    plugins: [
      {
        async serverWillStart() {
          console.log('GraphQL server starting...');
        },
      },
    ],
  });
};

module.exports = { createApolloServer };
