import * as http from 'http';
import * as socketio from 'socket.io';
import { CommandToClient, CommandToServer } from "../common/command";
import * as field from "../common/field";
import * as back_end from "./back_end";
import { inspect } from 'util';

const server: http.Server = http.createServer();
const io: socketio.Server = new socketio.Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const getMethods = (obj: object): string[] => {
  const getOwnMethods = (obj: object) =>
    Object.entries(Object.getOwnPropertyDescriptors(obj))
      .filter(([name, { value }]) => typeof value === 'function' && name !== 'constructor')
      .map(([name]) => name)
  const _getMethods = (o: object, methods: string[]): string[] =>
    o === Object.prototype ? methods : _getMethods(Object.getPrototypeOf(o), methods.concat(getOwnMethods(o)))
  return _getMethods(obj, [])
}

let socket1_ready: boolean = false;
let s1: socketio.Socket;
io.on('connection', (socket: socketio.Socket) => {
  if (socket1_ready) {
    socket1_ready = false;

    console.log(`got s2:${socket.id}`);
    // console.log(inspect(socket));
    socket.emit("ToClientCommand", { cmd: "ServerWaiting", first_player: false });
    s1.emit("ToClientCommand", { cmd: "ha-Aretz" });

    back_end.connect_two_sockets(s1, socket);
  } else {
    socket1_ready = true;
    s1 = socket;

    console.log(`got s1:${s1.id}:${s1.conn.port}`);
    s1.emit("ToClientCommand", { cmd: "ServerWaiting", first_player: true });
  }
});

const port = 1469;
server.listen(port, () => console.log(`app listening on port ${port}`));



