const crypto = require('crypto');

// Secret retrieved strictly from environment; never hardcoded or committed
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'demo') {
      return 'ephemeral-testing-secret-do-not-use-in-prod-xyz123';
    }
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return secret;
}

// Secure base64url encoding / decoding without external dependencies
function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer);
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Password Hashing with Salt using PBKDF2
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedCombinedHash) {
  const [salt, originalHash] = storedCombinedHash.split(':');
  if (!salt || !originalHash) return false;
  const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hashToVerify, 'utf8'), Buffer.from(originalHash, 'utf8'));
}

/**
 * Standard HMAC SHA256 JWT Generation
 */
function generateJwt(payload, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

/**
 * Verify JWT signature and token expiration
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token missing or invalid format.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token structure.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Constant-time signature verification
  const expectedSignature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const expectedEncodedSignature = base64UrlEncode(expectedSignature);

  if (!crypto.timingSafeEqual(Buffer.from(encodedSignature), Buffer.from(expectedEncodedSignature))) {
    throw new Error('Invalid token signature.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    const expiredError = new Error(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    expiredError.name = 'TokenExpiredError';
    expiredError.expiredAt = payload.exp;
    throw expiredError;
  }

  return payload;
}

module.exports = {
  getJwtSecret,
  hashPassword,
  verifyPassword,
  generateJwt,
  verifyJwt
};
