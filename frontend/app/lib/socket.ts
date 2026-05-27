import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003', {
      auth: {
        token,
      },
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
