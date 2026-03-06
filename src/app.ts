import express, { Application, Request, Response, NextFunction } from 'express';
import { corsMiddleware } from './middleware/cors.middleware';
// import { rateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import config from './config/env';
import routes from './routes';

const app: Application = express();

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({
    success: true,
    message: 'Restaurant HMS Backend API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
