import { clearAuthUnauthorized, setSessionCookie } from '#src/services/appRequest.js';
import { createJwtToken, verifyJwtToken } from '#src/services/jwt.service.js';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

const middleware = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const allowList = ['signin', 'signup', 'signout', 'resetPassword', 'health', 'test'];
  const allowListPaths = ['/api/v1/health', '/api/v1/test'];
  const pathname = req.path || '';
  // console.log('>>>>>>>>>> token: ', token);


  const itsFor = req.body?.itsFor || req.query?.itsFor || '';
  if (allowList.includes(itsFor) || allowListPaths.includes(pathname)) {
    // logger.info('middleware: itsFor is in allowList, skipping auth check');
    return next();
  }



  if (!token) {
    // logger.info('middleware: No token found in cookies');
    return clearAuthUnauthorized(res);
  }


  if (token) {
    try {
      // req.body.auth = verifyJwtToken(token);
      let verifiedData = verifyJwtToken(token);
      if (verifiedData) {
        // logger.info('middleware:verifiedData:', verifiedData);
        const newVfData = createJwtToken('30d', verifiedData);
        // logger.info('middleware:newVfData:', newVfData);
        // console.log('middleware:newVfData:', newVfData);
        // setSessionCookie(res, newVfData);

        req.body.auth = verifiedData;
      } else {
        return clearAuthUnauthorized(res);
      }
    } catch (err) {
      // logger.error('middleware:Invalid token:', err.message);
      return clearAuthUnauthorized(res);
    }
  }

  next();
};



export default middleware;
