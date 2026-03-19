import { createAccessToken, parseAccessPasswords, safeEquals } from './_lib/auth.js';
import { applyCors, handleOptions, rejectDisallowedOrigin } from './_lib/cors.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  const corsState = applyCors(req, res, 'POST,OPTIONS');

  if (handleOptions(req, res)) {
    return;
  }

  if (rejectDisallowedOrigin(req, res, corsState)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, { scope: 'verify-access', limit: 10, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  const configuredPasswords = parseAccessPasswords();
  if (configuredPasswords.length === 0) {
    return res.status(500).json({ success: false, error: 'Access password not configured' });
  }

  const isValid = configuredPasswords.some((candidate) => safeEquals(password, candidate));
  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid Access Key' });
  }

  const session = createAccessToken(configuredPasswords);
  return res.status(200).json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    tokenType: 'Bearer'
  });
}
