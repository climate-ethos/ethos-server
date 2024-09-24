const auth = require('basic-auth');
const nano = require('nano');

const authMiddleware = (req, res, next) => {
  const user = auth(req);
  if (!user || user.name !== process.env.USERNAME || user.pass !== process.env.PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
    return;
  }
  next();
};

const authMiddlewareCouchDB = async (req, res, next) => {
  const credentials = auth(req);

  if (!credentials) {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
    return;
  }

  const { name, pass } = credentials;

  try {
    // Initialize the CouchDB connection
    const couch = nano(process.env.COUCHDB_URL);

    // Attempt to log in to CouchDB
    await couch.auth(name, pass);

    // If successful, attach the authenticated username to the request object
    req.authenticatedUser = name;

    // Proceed to the next middleware
    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Invalid credentials.');
  }
};


module.exports = { authMiddleware, authMiddlewareCouchDB }