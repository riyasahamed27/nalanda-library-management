const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');

/**
 * JWT Utility with encryption layer for enhanced security
 */
class JWTManager {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.encryptionKey = process.env.JWT_ENCRYPTION_KEY;
  }

  /**
   * Generate a JWT token with encryption
   * @param {Object} payload - Data to include in the token
   * @returns {string} - Encrypted JWT token
   */
  generateToken(payload) {
    // Create the JWT token
    const token = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'nalanda-library',
      audience: 'nalanda-users',
    });

    // Encrypt the token for additional security
    const encryptedToken = this.encrypt(token);
    return encryptedToken;
  }

  /**
   * Verify and decrypt a JWT token
   * @param {string} encryptedToken - The encrypted JWT token
   * @returns {Object} - Decoded token payload
   */
  verifyToken(encryptedToken) {
    try {
      // Decrypt the token first
      const token = this.decrypt(encryptedToken);

      // Verify the JWT
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'nalanda-library',
        audience: 'nalanda-users',
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Encrypt a string using AES encryption
   * @param {string} data - Data to encrypt
   * @returns {string} - Encrypted data
   */
  encrypt(data) {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  /**
   * Decrypt an AES encrypted string
   * @param {string} encryptedData - Encrypted data
   * @returns {string} - Decrypted data
   */
  decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} encryptedToken - The encrypted JWT token
   * @returns {Object} - Decoded token payload
   */
  decodeToken(encryptedToken) {
    try {
      const token = this.decrypt(encryptedToken);
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a refresh token with longer expiry
   * @param {Object} payload - Data to include in the token
   * @returns {string} - Encrypted refresh token
   */
  generateRefreshToken(payload) {
    const token = jwt.sign(
      { ...payload, type: 'refresh' },
      this.secret,
      {
        expiresIn: '30d',
        issuer: 'nalanda-library',
        audience: 'nalanda-users',
      }
    );
    return this.encrypt(token);
  }
}

// Export singleton instance
const jwtManager = new JWTManager();

module.exports = {
  generateToken: (payload) => jwtManager.generateToken(payload),
  verifyToken: (token) => jwtManager.verifyToken(token),
  decodeToken: (token) => jwtManager.decodeToken(token),
  generateRefreshToken: (payload) => jwtManager.generateRefreshToken(payload),
};
