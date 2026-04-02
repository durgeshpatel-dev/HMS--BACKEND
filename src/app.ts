import express, { Application } from 'express';
import path from 'path';
import { corsMiddleware } from './middleware/cors.middleware';
// import { rateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { attachRequestContext } from './middleware/requestContext.middleware';
import config from './config/env';
import routes from './routes';

const app: Application = express();

// Request context + structured request completion logging
app.use(attachRequestContext);

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.resolve('./uploads')));

// app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbConnected = Boolean(req.app.locals?.dbConnected);

  res.json({
    success: true,
    message: 'Restaurant HMS Backend API is running',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    environment: config.nodeEnv,
    database: dbConnected ? 'connected' : 'connecting_or_unavailable',
  });
});

// Email health check endpoint (manager-only diagnostic)
app.get('/health/email', async (req, res) => {
  const emailService = require('./services/email.service').default;
  const smtpOk = await emailService.verifyConnection();

  res.json({
    success: true,
    smtp: {
      configured: true,
      connected: smtpOk,
      host: config.mail.host,
      port: config.mail.port,
      user: config.mail.user ? `${config.mail.user.slice(0, 4)}***` : '(not set)',
    },
  });
});

// Root endpoint (production-friendly API landing response)
app.get('/', (_req, res) => {
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
