import app from './app';
import config from './config/env';
import prisma, { pool } from './config/database';

const PORT = config.port;

// Catch unhandled errors so the process doesn't silently hang
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

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
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
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
