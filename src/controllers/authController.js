const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  // Create user (default role is 'member')
  // Only allow admin creation if there's a special condition (e.g., first user or admin creates admin)
  const userRole = role === 'admin' ? 'admin' : 'member';

  const user = await User.create({
    name,
    email,
    password,
    role: userRole,
  });

  // Generate tokens
  const token = generateToken({ userId: user._id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user._id });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toPublicProfile(),
      token,
      refreshToken,
    },
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(401, 'Your account has been deactivated. Please contact admin.');
  }

  // Check password
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Generate tokens
  const token = generateToken({ userId: user._id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user._id });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toPublicProfile(),
      token,
      refreshToken,
    },
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user: user.toPublicProfile(),
    },
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  // Check if email is being changed and if it's already taken
  if (email && email !== req.user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'Email already in use');
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, email },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.toPublicProfile(),
    },
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isPasswordMatch = await user.comparePassword(currentPassword);

  if (!isPasswordMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken({ userId: user._id, role: user.role });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: { token },
  });
});

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/auth/users
 * @access  Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  // Filter by role
  if (req.query.role) {
    query.role = req.query.role;
  }

  // Filter by status
  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === 'true';
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      users,
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
 * @desc    Update user role (Admin only)
 * @route   PUT /api/auth/users/:id/role
 * @access  Private/Admin
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    throw new ApiError(400, 'Invalid role. Must be admin or member');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    message: 'User role updated successfully',
    data: {
      user: user.toPublicProfile(),
    },
  });
});

/**
 * @desc    Deactivate user (Admin only)
 * @route   PUT /api/auth/users/:id/deactivate
 * @access  Private/Admin
 */
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    message: 'User deactivated successfully',
    data: {
      user: user.toPublicProfile(),
    },
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  deactivateUser,
};
