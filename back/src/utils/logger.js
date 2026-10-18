import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Writable } from 'node:stream';

const requestContext = new AsyncLocalStorage();

const handlePinoLog = (log) => {
  // no-op placeholder
};

const createLogStream = (onLog) => {
  let buffer = '';

  return new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line) continue;

        try {
          onLog(JSON.parse(line));
        } catch (error) {
          console.error('Failed to parse pino log:', error.message);
        }
      }

      callback();
    },
  });
};

const prettyStream = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'type,env,service,correlation_id,ip',
  },
});

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// multistream filters per stream, so each stream needs the level too
const streams = pino.multistream([
  { level: LOG_LEVEL, stream: prettyStream },
  { level: LOG_LEVEL, stream: createLogStream(handlePinoLog) },
]);

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
    // Allows logger.info('msg', { foo: 1 }) as well as pino's native logger.info({ foo: 1 }, 'msg')
    logMethod(args, method) {
      if (
        args.length >= 2 &&
        typeof args[0] === 'string' &&
        args[1] !== null &&
        typeof args[1] === 'object'
      ) {
        const [msg, obj, ...rest] = args;
        return method.call(this, obj, msg, ...rest);
      }
      return method.apply(this, args);
    },
  },
  redact: ['password', 'token', 'authorization', '*.credit_card'],
}, streams);

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