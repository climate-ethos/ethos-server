const auth = require('basic-auth');

const authMiddleware = (req, res, next) => {
  const user = auth(req);
  if (!user || user.name !== process.env.USERNAME || user.pass !== process.env.PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
    return;
  }
  next();
};

module.exports = { authMiddleware }