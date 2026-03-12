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
    const restaurantIdNumber = Number(restaurantId);

    // Join restaurant-specific room
    if (restaurantId) {
      socket.join(`restaurant:${restaurantId}`);
      console.log(`Socket ${socket.id} joined restaurant:${restaurantId}`);
    }
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined user:${userId}`);
    }

    // Handle incoming order status update from mobile/dashboard
    socket.on('order:updateStatus', async (data: { orderId: string; status: string }) => {
      try {
        const { orderId, status } = data;
        console.log(`Socket event: order:updateStatus - Order ${orderId} to ${status}`);

        if (!restaurantIdNumber) {
          throw new Error('Invalid restaurant context');
        }
        
        // Import order service dynamically to avoid circular dependencies
        const { orderService } = await import('../services/order.service');
        const updatedOrder = await orderService.updateOrder(
          Number(orderId),
          { status: status as any },
          restaurantIdNumber
        );
        
        // Broadcast to all clients in restaurant
        if (restaurantId) {
          io.to(`restaurant:${restaurantId}`).emit('order:updated', updatedOrder);
        }
        
        // Acknowledge success back to sender
        socket.emit('order:updateStatus:success', { orderId, status });
      } catch (error: any) {
        console.error('Error updating order status via socket:', error);
        socket.emit('order:updateStatus:error', { 
          orderId: data.orderId, 
          error: error.message 
        });
      }
    });

    // Handle table status update from mobile/dashboard
    socket.on('table:updateStatus', async (data: { tableId: string; status: string }) => {
      try {
        const { tableId, status } = data;
        console.log(`Socket event: table:updateStatus - Table ${tableId} to ${status}`);

        if (!restaurantIdNumber) {
          throw new Error('Invalid restaurant context');
        }
        
        const { tableService } = await import('../services/table.service');
        const updatedTable = await tableService.updateTableStatus(
          Number(tableId),
          { status: status as any },
          restaurantIdNumber
        );
        
        // Broadcast to all clients in restaurant
        if (restaurantId) {
          io.to(`restaurant:${restaurantId}`).emit('table:updated', updatedTable);
        }
        
        socket.emit('table:updateStatus:success', { tableId, status });
      } catch (error: any) {
        console.error('Error updating table status via socket:', error);
        socket.emit('table:updateStatus:error', { 
          tableId: data.tableId, 
          error: error.message 
        });
      }
    });

    // Handle kitchen alert from dashboard
    socket.on('kitchen:sendAlert', (data: { message: string; orderId?: string }) => {
      console.log(`Socket event: kitchen:sendAlert - ${data.message}`);
      if (restaurantId) {
        io.to(`restaurant:${restaurantId}`).emit('kitchen:alert', {
          message: data.message,
          orderId: data.orderId,
          timestamp: new Date(),
        });
      }
    });

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

export const emitMenuUpdate = (restaurantId: number, data: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('menu:updated', data);
};

export const emitCategoryUpdate = (restaurantId: number, data: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('category:updated', data);
};

export const emitBillingRequest = (restaurantId: number, data: any) => {
  if (!io) return;
  io.to(`restaurant:${restaurantId}`).emit('billing:request', data);
};

export default {
  initSocket,
  getSocketIO,
  emitOrderUpdate,
  emitOrderCreated,
  emitBillUpdate,
  emitTableStatusUpdate,
  emitKitchenAlert,
  emitMenuUpdate,
  emitCategoryUpdate,
  emitBillingRequest,
};
