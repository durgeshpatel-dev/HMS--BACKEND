import app from './app';
import config from './config/env';
import prisma from './config/database';

const PORT = config.port;

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
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        console.log('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(async () => {
        console.log('HTTP server closed');
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
