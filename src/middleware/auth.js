const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Find user and attach to request
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token.',
    });
  }
};

/**
 * Role-based authorization middleware
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

/**
 * Admin only middleware
 */
const adminOnly = authorize('admin');

/**
 * Member only middleware
 */
const memberOnly = authorize('member');

/**
 * Admin or Member middleware (authenticated users)
 */
const authenticated = authorize('admin', 'member');

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  memberOnly,
  authenticated,
};
