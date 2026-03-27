import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
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
app.options('*', corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.resolve('./uploads')));

// app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  const dbConnected = Boolean(req.app.locals?.dbConnected);

  res.json({
    success: true,
    message: 'Restaurant HMS Backend API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: dbConnected ? 'connected' : 'connecting_or_unavailable',
  });
});

// Root endpoint (production-friendly API landing response)
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Restaurant HMS Backend API',
    status: 'running',
  });
});

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
