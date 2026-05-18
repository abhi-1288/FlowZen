declare module "socket.io-client" {
  export type Socket = {
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    disconnect: () => void;
  };

  export function io(options?: {
    path?: string;
    addTrailingSlash?: boolean;
  }): Socket;
}

declare module "socket.io" {
  export class Server {
    constructor(server: unknown, options?: { path?: string; addTrailingSlash?: boolean });
    on(event: "connection", callback: (socket: { on: (event: string, cb: (...args: unknown[]) => void) => void; join: (room: string) => void }) => void): void;
    to(room: string): { emit: (event: string, payload?: unknown) => void };
  }
}
