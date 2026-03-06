import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from './env';

let io: SocketIOServer | null = null;

export const initSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication failed'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const restaurantId = socket.data.user?.restaurantId;
    const userId = socket.data.user?.userId;

    // Join restaurant-specific room
    if (restaurantId) {
      socket.join(`restaurant:${restaurantId}`);
      console.log(`Socket ${socket.id} joined restaurant:${restaurantId}`);
    }
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined user:${userId}`);
    }

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
    });

    // Keep alive ping
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  return io;
};

export const getSocketIO = (): SocketIOServer | null => io;

export const emitOrderUpdate = (restaurantId: number, order: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('order:updated', order);
};

export const emitOrderCreated = (restaurantId: number, order: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('order:created', order);
};

export const emitBillUpdate = (restaurantId: number, bill: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('bill:updated', bill);
};

export const emitTableStatusUpdate = (restaurantId: number, table: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('table:updated', table);
};

export const emitKitchenAlert = (restaurantId: number, order: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('kitchen:alert', order);
};

export default {
  initSocket,
  getSocketIO,
  emitOrderUpdate,
  emitOrderCreated,
  emitBillUpdate,
  emitTableStatusUpdate,
  emitKitchenAlert,
};
