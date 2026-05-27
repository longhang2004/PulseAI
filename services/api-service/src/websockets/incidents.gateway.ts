import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UseFilters } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      console.log(`[Socket] Connection rejected: Missing token.`);
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'pulseai_jwt_secret_key_2026',
      });
      socket.data.user = payload;
      console.log(`[Socket] Client authenticated: ${socket.id} (user: ${payload.email || payload.sub})`);
    } catch (err: any) {
      console.log(`[Socket] Connection rejected: Invalid token.`, err.message);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('join_project')
  handleJoinProject(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { projectId } = data;
    if (projectId) {
      socket.join(`project:${projectId}`);
      console.log(`[Socket] Client ${socket.id} joined project room: project:${projectId}`);
      return { status: 'success', room: `project:${projectId}` };
    }
    return { status: 'error', message: 'Missing projectId' };
  }

  broadcastIncidentEvent(projectId: string, eventName: string, payload: any) {
    this.server.to(`project:${projectId}`).emit(eventName, payload);
    console.log(`[Socket] Broadcast event ${eventName} to project:${projectId}`);
  }
}
