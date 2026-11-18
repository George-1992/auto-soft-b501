import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { logger } from '#src/utils/logger.js';
import { nanoid } from 'nanoid';


const apiSecret = process.env.AUTH_TOKEN_SECRET;

const createJwtToken = (expires, data) => {
  if (!apiSecret) {
    logger.error('Error creating token: API_SECRET is not defined in environment variables');
    return null;
  }

  // Clone data so we don't mutate the original object, and strip old JWT claims
  const { exp, iat, jti, ...cleanData } = data || {};

  const payload = {
    ...cleanData,
    jti: nanoid(15)
  };

  return jwt.sign(payload, apiSecret, { expiresIn: expires });
};

const verifyJwtToken = (token, secret) => {
  try {
    const _secret = secret || apiSecret;
    return jwt.verify(token, _secret);
  } catch (err) {
    logger.error('Error verifying token: ', err.message || err);
    return false;
  }
};

const createJwtTokenOther = (secret, expires, data) => {
  const resolvedSecret = secret;

  if (!resolvedSecret) {
    logger.error('Error creating token: ', secret);
    return null;
  }

  const payload = data || {};
  return jwt.sign(payload, resolvedSecret, { expiresIn: expires });
};

export { createJwtToken, verifyJwtToken, createJwtTokenOther };
