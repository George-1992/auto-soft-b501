import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { format } from 'node:util';

const requestContext = new AsyncLocalStorage();
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level(label, number) {
      return { level: number, type: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'my-app-name',
  },
  mixin() {
    return { ...(requestContext.getStore() || {}) };
  },
  hooks: {
    logMethod(args, method) {
      const [firstArg, secondArg, ...restArgs] = args;
      const hasPrintfPlaceholders =
        typeof firstArg === 'string' && /%[sdifjoO%]/.test(firstArg);

      if (
        args.length >= 2 &&
        typeof firstArg === 'string' &&
        !hasPrintfPlaceholders &&
        secondArg !== null &&
        typeof secondArg === 'object'
      ) {
        return method.call(this, secondArg, firstArg, ...restArgs);
      }

      if (args.length >= 2 && typeof firstArg === 'string') {
        return method.call(this, format(firstArg, secondArg, ...restArgs));
      }

      return method.apply(this, args);
    },
  },
  redact: ['password', 'token', 'authorization', '*.credit_card'],
});

const attachLogger = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('X-Correlation-Id', correlationId);

  const context = {
    correlation_id: correlationId,
    user_id: req.user?.id,
    ip: req.ip,
  };

  requestContext.run(context, () => {
    req.log = logger.child({
      method: req.method,
      url: req.url,
    });

    next();
  });
};

export { logger, attachLogger };