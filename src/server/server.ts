import * as http from 'http';
import * as socketio from 'socket.io';
import { CommandToClient, CommandToServer } from "../common/command";
import * as field from "../common/field";
import * as back_end from "./back_end";

const server: http.Server = http.createServer();
const io: socketio.Server = new socketio.Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let socket1_ready: boolean = false;
let s1: socketio.Socket
io.on('connection', (socket: socketio.Socket) => {
  let wait: CommandToClient = { cmd: "ServerWaiting" };
  socket.emit("ToClientCommand", wait);
  if (socket1_ready) {
    socket1_ready = false;
    back_end.connect_two_sockets(s1, socket);

  } else {
    socket1_ready = true;
    s1 = socket;
  }
});

const port = 5000;
server.listen(port, () => console.log(`app listening on port ${port}`));



