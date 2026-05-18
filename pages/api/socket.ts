import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types/socket";
import { Server } from "socket.io";

declare global {
  var io: any;
}

export default function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: "/api/socket_io",
      addTrailingSlash: false
    });

    io.on("connection", (socket) => {
      socket.on("user:subscribe", (userId: unknown) => {
        const resolved = String(userId ?? "").trim();
        if (!resolved) return;
        socket.join(`user:${resolved}`);
      });
    });

    res.socket.server.io = io;
    global.io = io;
  }

  res.end();
}
