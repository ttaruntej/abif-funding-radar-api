import crypto from 'node:crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TOKEN_TTL_SECONDS = 8 * 60 * 60;
const STORAGE_HEADER = 'x-access-token';

export const parseAccessPasswords = () => {
  const raw = [
    process.env.ACCESS_PASSWORDS,
    process.env.ACCESS_PASSWORD,
    process.env.SITE_PASSWORD,
    process.env.ADMIN_PASSWORD
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(raw));
};

export const safeEquals = (input, target) => {
  const inputBuffer = Buffer.from(String(input || ''));
  const targetBuffer = Buffer.from(String(target || ''));

  if (inputBuffer.length !== targetBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, targetBuffer);
};

const tokenTtlSeconds = () => {
  const value = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || DEFAULT_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(value)) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }

  return Math.max(60, Math.floor(value));
};

const deriveFallbackSecret = (configuredPasswords = []) => {
  if (configuredPasswords.length === 0) {
    return '';
  }

  return crypto
    .createHash('sha256')
    .update(configuredPasswords.join('|'))
    .digest('hex');
};

const getSessionSecret = (configuredPasswords = []) => {
  const configuredSecret = (process.env.ACCESS_SESSION_SECRET || process.env.AUTH_SESSION_SECRET || '').trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  return deriveFallbackSecret(configuredPasswords);
};

const encodePayload = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
const decodePayload = (encodedPayload) => JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

const signPayload = (encodedPayload, secret) => (
  crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
);

export const createAccessToken = (configuredPasswords = []) => {
  const secret = getSessionSecret(configuredPasswords);
  if (!secret) {
    throw new Error('Access session secret is not configured');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + tokenTtlSeconds();
  const payload = {
    v: TOKEN_VERSION,
    iat: issuedAt,
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString('base64url')
  };

  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
};

export const extractAccessToken = (req) => {
  const authorization = String(req.headers?.authorization || '').trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  const tokenHeader = String(req.headers?.[STORAGE_HEADER] || '').trim();
  return tokenHeader;
};

export const verifyAccessToken = (token, configuredPasswords = []) => {
  if (!token) {
    return { ok: false, error: 'Missing access token' };
  }

  const secret = getSessionSecret(configuredPasswords);
  if (!secret) {
    return { ok: false, error: 'Access session secret is not configured' };
  }

  const [encodedPayload, providedSignature] = String(token).split('.');
  if (!encodedPayload || !providedSignature) {
    return { ok: false, error: 'Malformed access token' };
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEquals(providedSignature, expectedSignature)) {
    return { ok: false, error: 'Invalid access token signature' };
  }

  let payload;
  try {
    payload = decodePayload(encodedPayload);
  } catch (error) {
    return { ok: false, error: 'Malformed access token payload' };
  }

  if (!payload || payload.v !== TOKEN_VERSION || !payload.exp) {
    return { ok: false, error: 'Invalid access token payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { ok: false, error: 'Access token expired' };
  }

  return { ok: true, payload };
};

export const requireAccessToken = (req, res, configuredPasswords = []) => {
  const token = extractAccessToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in again.' });
    return false;
  }

  const verification = verifyAccessToken(token, configuredPasswords);
  if (!verification.ok) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return false;
  }

  return true;
};
