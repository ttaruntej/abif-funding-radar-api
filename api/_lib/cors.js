const DEFAULT_HEADERS = 'Authorization, X-Access-Token, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://ttaruntej.github.io',
  'https://www.ttaruntej.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const parseAllowedOrigins = () => {
  const configured = [process.env.ALLOWED_ORIGINS, process.env.ALLOWED_ORIGIN]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? Array.from(new Set(configured)) : DEFAULT_ALLOWED_ORIGINS;
};

export const applyCors = (req, res, methods = 'GET,POST,OPTIONS') => {
  const allowedOrigins = parseAllowedOrigins();
  const requestOrigin = req.headers?.origin;
  const allowAnyOrigin = allowedOrigins.includes('*');
  const originAllowed = allowAnyOrigin || !requestOrigin || allowedOrigins.includes(requestOrigin);
  const selectedOrigin = allowAnyOrigin
    ? '*'
    : allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Credentials', allowAnyOrigin ? 'false' : 'true');
  res.setHeader('Access-Control-Allow-Origin', selectedOrigin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', DEFAULT_HEADERS);
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  return { allowedOrigins, selectedOrigin, allowAnyOrigin, requestOrigin, originAllowed };
};

export const rejectDisallowedOrigin = (req, res, corsState) => {
  if (!corsState) {
    return false;
  }

  if (corsState.requestOrigin && !corsState.originAllowed) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }

  return false;
};

export const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
};
