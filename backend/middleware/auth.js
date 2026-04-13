const jwt = require('jsonwebtoken');

// middleware to verify jwt token from authorization header
const authMiddleware = (req, res, next) => {
  try {
    // get authorization header from request
    const authHeader = req.headers.authorization;

    // check if authorization header is missing
    if (!authHeader) {
      return res.status(401).json({ message: 'Unauthorised: invalid or missing token' });
    }

    // check if authorization header starts with bearer
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorised: invalid or missing token' });
    }

    // extract token from bearer string
    const token = authHeader.slice(7);

    // verify token using jwt secret from env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach decoded payload to request object
    req.user = decoded;

    // call next middleware or route handler
    next();
  } catch (error) {
    // catch any errors from token verification
    return res.status(401).json({ message: 'Unauthorised: invalid or missing token' });
  }
};

module.exports = authMiddleware;
