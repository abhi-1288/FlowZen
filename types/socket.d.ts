import type { NextApiResponse } from "next";
import type { Server as NetServer } from "http";
import type { Socket } from "net";
import type { Server as SocketIOServer } from "socket.io";

export type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};
