import * as socketio from "socket.io";
import { Level, Logger, check_twice_call } from "../common/my_util";
import { CommandToClient, CommandToServer } from "../common/command";
import { BallPacket, FoulType, Turn } from "../common/field";

class GameSnapShot {
  public balls: BallPacket[];
  public turn: Turn;
  public pockets: Set<number>;
  public fouls: Set<FoulType>;

  constructor(balls: BallPacket[], turn: Turn, fouls: Set<FoulType>, pockets: Set<number>) {
    this.balls = balls;
    this.turn = turn;
    this.fouls = fouls;
    this.pockets = pockets;
  }
}

class GameInfo {
  // Parameters
  private restit = 0.95;
  private drag = 0.8;
  private stop_threshold = 2;

  // Sockets
  private s1: socketio.Socket;
  private s2: socketio.Socket;

  // Game informations
  private client_ready_oks = 0;
  private turn: Turn = 1;
  private game_started = false;
  private is_waiting_player = false;
  private snapshots: GameSnapShot[] = [];
  private latest_state: GameSnapShot;
  private scores: [number, number] = [0, 0];

  // Hooks
  public hooks: ((s: socketio.Socket, c: CommandToServer) => void)[] = new Array();

  // Logger
  private log: Logger = new Logger();

  constructor(s1: socketio.Socket, s2: socketio.Socket) {
    this.s1 = s1;
    this.s2 = s2;

    /*
    this.hooks.push((s: socketio.Socket, c: CommandToServer) => {
      // debug hook.
      this.log.deb(`Got command from ${s.id}, ${c.cmd}`);
    });
    */

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
        this.log.log_in("ClientListenerReady", Level.Notice);
        this.emit_to(s, { cmd: "PrepareStart" });
        break;
      }
      case "RequestParameter": { // Reply parameter
        this.log.deb("got RequestParameter");
        // this.emit_to(s, { cmd: "ReplyParameter", restit: this.restit, drag: this.drag, stop_threshold: this.stop_threshold });
        if (s == this.s1) {
          this.emit_to(s, { cmd: "ReplyParameter", restit: this.restit, drag: this.drag, stop_threshold: this.stop_threshold, turn: 1 });
        } else {
          this.emit_to(s, { cmd: "ReplyParameter", restit: this.restit, drag: this.drag, stop_threshold: this.stop_threshold, turn: 2 });
        }
        break;
      }
      case "ClientReady": { // Client initialized objects.
        this.client_ready_oks++;

        if (this.client_ready_oks != 2) {
          this.log.deb("wait for other client");
          break;
        }

        this.game_started = true;
        this.log.deb("both client ready. start game");

        this.prompt_turn(); // game start!!
        break;
      }
      case "FinishTurn": {
        this.is_waiting_player = false; // Disable timeout error.
        if (this.check_state()) { // timing when check_state is called, turn is latest player.
          this.log.log_in("game end", Level.Notice);
          break;
        }

        this.turn = (this.turn == 1) ? 2 : 1;
        this.prompt_turn(); // next turn
        break;
      }
      case "SyncCoordinate": {
        let sync = c.packet;
        let state = new GameSnapShot(
          sync.balls,
          this.turn,
          new Set(sync.fouls),
          new Set(sync.pockets),
        );
        this.snapshots.push(state); // save state
        this.latest_state = state; // access here
        this.emit({ cmd: "UpdateCoordinate", packet: this.latest_state.balls });
        break;
      }
    }
  }

  public apply_receive() {
    // register hook events to sockets.
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

  public check_state(): boolean {
    // this function updates scores with latest state.
    // if all balls are pocketed, game well end.
    // return true if game end.

    // update scores.
    let player_index = (this.turn == 1) ? 0 : 1;
    let opponent_index = (this.turn == 1) ? 1 : 0;

    this.log.deb(Array.from(this.latest_state.pockets));
    for (let ball_number of Array.from(this.latest_state.pockets)) {
      this.scores[player_index] += ball_number;
    }
    for (let foul of Array.from(this.latest_state.fouls)) {
      switch (foul) {
        case "NoHit": {
          this.scores[player_index] -= 1;
          break;
        }
        case "WhiteOut": {
          this.scores[player_index] -= 2;
          break;
        }
      }
    };

    let all_pocketed = true;
    let counter = 0; // for debug
    for (let i = 1; i <= 15; i++) {
      if (this.latest_state.balls[i] != null) {
        all_pocketed = false;
        // break;
      } else {
        counter++;
      }
    }

    this.log.log_in(`scores are : ${this.scores[0]} : ${this.scores[1]}`, Level.Notice);

    if (all_pocketed) { // || counter >= 3) {
      this.log.log_in("all balls pocketed", Level.Notice);
      this.game_end();

      return true;
    }

    return false;
  }

  public game_end() {
    this.log.log_in(`Game end. scores are : ${this.scores[0]} : ${this.scores[1]}`, Level.Notice);
    if (this.scores[0] == this.scores[1]) {
      this.emit({ cmd: "GameEnd", winner: null });
    } else {
      let winner: Turn = (this.scores[0] > this.scores[1]) ? 1 : 2;
      this.emit({ cmd: "GameEnd", winner: winner });
    }
  }

  public prompt_turn() {
    if (this.game_started == false) {
      this.log.log_in("game not started yet", Level.Error);
      return;
    }

    this.is_waiting_player = true; // Enable timeout error.
    // this variable well be disable when receive FinishTurn command.

    if (this.turn == 1) {
      this.emit_to(this.s1, { cmd: "YourTurn" });
    } else {
      this.emit_to(this.s2, { cmd: "YourTurn" });
    }

    setTimeout(() => {
      if (this.is_waiting_player == true) {
        this.log.log_in("operation timeout", Level.Error);
        this.emit({ cmd: "InternalServerError", err: "Client time out" });
      }
    }, 100000000); // 面倒だし、これでいいのかな？
  }
}

export function connect_two_sockets(s1: socketio.Socket, s2: socketio.Socket) {
  console.log(s1.id);
  console.log(s2.id);

  console.log("waiting for sending the coordinates.")

  let g = new GameInfo(s1, s2);
}

