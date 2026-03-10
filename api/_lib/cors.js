const DEFAULT_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version';

const parseAllowedOrigins = () => {
  const configured = [process.env.ALLOWED_ORIGINS, process.env.ALLOWED_ORIGIN]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : ['*'];
};

export const applyCors = (req, res, methods = 'GET,POST,OPTIONS') => {
  const allowedOrigins = parseAllowedOrigins();
  const requestOrigin = req.headers?.origin;
  const allowAnyOrigin = allowedOrigins.includes('*');
  const selectedOrigin = allowAnyOrigin
    ? '*'
    : allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', selectedOrigin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', DEFAULT_HEADERS);
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  return { allowedOrigins, selectedOrigin };
};

export const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
};
