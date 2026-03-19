const buckets = new Map();

const nowMs = () => Date.now();

const cleanupExpiredBuckets = (currentTimeMs) => {
  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || bucket.resetAt <= currentTimeMs) {
      buckets.delete(key);
    }
  }
};

const clientAddress = (req) => {
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '').trim();
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = String(req.headers?.['x-real-ip'] || '').trim();
  if (realIp) {
    return realIp;
  }

  return 'unknown';
};

const clientFingerprint = (req) => {
  const ip = clientAddress(req);
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 120);
  return `${ip}|${userAgent || 'unknown-agent'}`;
};

const takeToken = ({ key, limit, windowMs }) => {
  const currentTimeMs = nowMs();
  cleanupExpiredBuckets(currentTimeMs);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= currentTimeMs) {
    bucket = {
      count: 0,
      resetAt: currentTimeMs + windowMs
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  };
};

export const enforceRateLimit = (req, res, { scope, limit, windowMs }) => {
  const result = takeToken({
    key: `${scope}:${clientFingerprint(req)}`,
    limit,
    windowMs
  });

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - nowMs()) / 1000));

  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

  if (result.allowed) {
    return true;
  }

  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  return false;
};
