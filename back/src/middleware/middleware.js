import { clearAuthUnauthorized, setSessionCookie } from '#src/services/appRequest.js';
import { createJwtToken, verifyJwtToken } from '#src/services/jwt.service.js';
import { logger } from '#src/utils/logger.js';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

const middleware = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const allowList = ['signin', 'signup', 'signout', 'resetPassword', 'health', 'test'];
  const allowListPaths = ['/api/v1/health', '/api/v1/test'];
  const pathname = req.path || '';
  // console.log('>>>>>>>>>> token: ', token);

  const requestUrl = req.originalUrl || req.url || '';
  const referrer = req.get('Referrer') || req.get('Referer') || '';
  const origin = req.get('Origin') || '';
  const accessControlAllowOrigin = req.get('Access-Control-Allow-Origin') || '';
  const requestHost = req.get('Host') || '';

  // if (!origin.includes(requestHost)) {
  //   logger.warn('middleware: Origin does not match request host, skipping auth check', {
  //     origin,
  //     requestHost,
  //   });
  // }

  const itsFor = req.body?.itsFor || req.query?.itsFor || '';
  // console.log('>>>>>>>>>> itsFor: ', itsFor);
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
