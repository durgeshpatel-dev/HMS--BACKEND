import app from './app';
import config from './config/env';
import prisma, { pool } from './config/database';

const PORT = config.port;
const DB_RETRY_INTERVAL_MS = 10000;

// Catch unhandled errors so the process doesn't silently hang
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

const startServer = async () => {
  let isDbConnected = false;

  const connectDatabaseWithRetry = async () => {
    try {
      await prisma.$connect();
      isDbConnected = true;
      app.locals.dbConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      isDbConnected = false;
      app.locals.dbConnected = false;
      console.error(`❌ Database connection failed. Retrying in ${DB_RETRY_INTERVAL_MS / 1000}s...`, error);

      setTimeout(() => {
        void connectDatabaseWithRetry();
      }, DB_RETRY_INTERVAL_MS);
    }
  };

  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🍽️  Restaurant HMS Backend API                     ║
║                                                       ║
║   Environment: ${config.nodeEnv.padEnd(37)}  ║
║   Port: ${PORT.toString().padEnd(44)}  ║
║   API Version: ${config.apiVersion.padEnd(38)}  ║
║                                                       ║
║   Server is running at:                               ║
║   http://0.0.0.0:${PORT}                               ║
║   http://localhost:${PORT}                             ║
║                                                       ║
║   Health Check:                                       ║
║   http://localhost:${PORT}/health                      ║
║   DB Status: ${isDbConnected ? 'connected' : 'connecting...'.padEnd(39)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });

    // Start DB connection attempts in background so server remains alive
    void connectDatabaseWithRetry();

    // Verify SMTP connection (non-blocking, won't prevent server start)
    const emailService = require('./services/email.service').default;
    emailService.verifyConnection().catch((err: any) => {
      console.error('[Server] Email service verification error:', err?.message || err);
    });

    // Initialize Socket.io
    const { initSocket } = require('./config/socket');
    const io = initSocket(server);

    // Additional event listeners for app specific logic
    io.on('connection', (socket: any) => {
      socket.on('join:room', (data: { userId: string, role: string }) => {
        socket.join(`role:${data.role}`);
        console.log(`User ${data.userId} with role ${data.role} joined room role:${data.role}`);
      });
    });

    // Attach io to app to be used in controllers
    app.set('io', io);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} signal received: closing HTTP server`);
      // Force exit after 5 seconds if graceful shutdown hangs
      const forceTimer = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 5000);
      forceTimer.unref();

      try {
        io.close(); // Close all socket connections first
        server.close(async () => {
          console.log('HTTP server closed');
          await prisma.$disconnect();
          await pool.end();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
