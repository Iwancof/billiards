import * as socketio from "socket.io";
import { Level, Logger } from "../common/my_util";
import { CommandToClient, CommandToServer } from "../common/command";

class GameInfo {
  // Parameters
  private restit = 0.95;
  private drag = 0.7;

  // Sockets
  private s1: socketio.Socket;
  private s2: socketio.Socket;

  // Hooks
  public hooks: ((c: CommandToServer) => void)[] = new Array();
  public hooks1: ((c: CommandToServer) => void)[] = new Array();
  public hooks2: ((c: CommandToServer) => void)[] = new Array();

  // Logger
  private log: Logger = new Logger();

  constructor(s1: socketio.Socket, s2: socketio.Socket) {
    this.s1 = s1;
    this.s2 = s2;

    this.hooks.push(this._show);
    this.hooks.push(this.receive);
    this.apply_recive();

    // Prepare ok.
    this.emit({ cmd: "PrepareStart" });
    this.log.log_in("Prepare started", Level.Notice);
  }

  public emit_to(s: socketio.Socket, c: CommandToClient) {
    s.emit("ToClientCommand", c);
  }
  public emit(c: CommandToClient) {
    this.s1.emit("ToClientCommand", c);
    this.s2.emit("ToClientCommand", c);
  }
  public receive(c: CommandToServer) {
    this.log.deb(c);
    switch (c.cmd) {
      case "RequestParameter": { // Reply parameter
        this.log.deb("Requested")
        this.emit({ cmd: "ReplyParameter", restit: this.restit, drag: this.drag });
      }
    }
  }
  public apply_recive() {
    // クライアントからリクエストを送ったのにレシーブされない。
    this.s1.on("ToServerCommand", this._receive1.bind(this));
    this.s2.on("ToServerCommand", this._receive2.bind(this));
  }

  public _show(c: CommandToServer) {
    this.log.deb(c);
  }
  public _receive1(c: CommandToServer) {
    // 受け取ってるかテスト
    for (var h in this.hooks) {
      this.hooks[h].call(this, c);
    }
    for (var h in this.hooks1) {
      this.hooks1[h].call(this, c);
    }
  }
  public _receive2(c: CommandToServer) {
    for (var h in this.hooks) {
      this.hooks[h].call(this, c);
    }
    for (var h in this.hooks2) {
      this.hooks2[h].call(this, c);
    }
  }
}

export function connect_two_sockets(s1: socketio.Socket, s2: socketio.Socket) {
  console.log(s1.id);
  console.log(s2.id);

  console.log("waiting for sending the coordinates.")

  let g = new GameInfo(s1, s2);
}

