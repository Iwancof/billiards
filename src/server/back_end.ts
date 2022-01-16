import * as socketio from "socket.io";
import { Level, Logger, check_twice_call } from "../common/my_util";
import { CommandToClient, CommandToServer } from "../common/command";

class GameInfo {
  // Parameters
  private restit = 0.95;
  private drag = 0.7;

  // Sockets
  private s1: socketio.Socket;
  private s2: socketio.Socket;

  // Hooks
  public hooks: ((s: socketio.Socket, c: CommandToServer) => void)[] = new Array();

  // Logger
  private log: Logger = new Logger();

  constructor(s1: socketio.Socket, s2: socketio.Socket) {
    this.s1 = s1;
    this.s2 = s2;

    this.hooks.push((s: socketio.Socket, c: CommandToServer) => {
      this.log.deb(`Got command from ${s.id}, ${c.cmd}`);
    });
    this.hooks.push(this.receive);
    this.apply_receive();

    // Prepare ok.
    this.log.log_in("Prepare started", Level.Notice);
  }

  public emit_to(s: socketio.Socket, c: CommandToClient) {
    s.emit("ToClientCommand", c);
  }
  public emit(c: CommandToClient) {
    this.s1.emit("ToClientCommand", c);
    this.s2.emit("ToClientCommand", c);
  }
  public receive(s: socketio.Socket, c: CommandToServer) {
    this.log.deb(`got from ${s.id}, ${c.cmd}`);

    switch (c.cmd) {
      case "ClientListenerReady": { // client scene created. so, event listener set.
        this.emit_to(s, { cmd: "PrepareStart" });
        break;
      }
      case "RequestParameter": { // Reply parameter
        this.emit_to(s, { cmd: "ReplyParameter", restit: this.restit, drag: this.drag });
        break;
      }
    }
  }
  public apply_receive() {
    this.s1.on("ToServerCommand", (c: CommandToServer) => {
      for (let h in this.hooks) {
        this.hooks[h].call(this, this.s1, c);
      }
    });
    this.s2.on("ToServerCommand", (c: CommandToServer) => {
      for (let h in this.hooks) {
        this.hooks[h].call(this, this.s2, c);
      }
    });
  }
}

export function connect_two_sockets(s1: socketio.Socket, s2: socketio.Socket) {
  console.log(s1.id);
  console.log(s2.id);

  console.log("waiting for sending the coordinates.")

  let g = new GameInfo(s1, s2);
}

