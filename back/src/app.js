import path from 'node:path';
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { attachLogger, logger } from '#src/utils/logger.js';
import middleware from '#src/middleware/middleware.js';
import cookieParser from 'cookie-parser';


const __dirname =  path.resolve(path.dirname(''));
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173',],
    credentials: true,
};
 
const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(middleware);
app.use(attachLogger);
app.use('/api/v1', routes);
app.use(express.static(path.join(__dirname, '..', 'public')));

export default app;
