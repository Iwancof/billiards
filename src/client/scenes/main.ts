import { get_int, InitRelativeCoordinates, Logger, Level } from "../../common/my_util"
import { CommandToServer, CommandToClient } from "../../common/command"
import { io, Socket } from "socket.io-client"
import { BallPacket } from "../../common/field";

export class MainScene extends Phaser.Scene {
  constructor() {
    super({
      key: "MainScene",
      active: false
    })
  }

  init(data: any): void {
    console.log(data);
  }

  // Parameters
  private restit_param = 0.95; // default setting ( overwrote by server )
  private drag_param = 0.7; // default settting ( overwrote by server )

  // Communications
  private port: number = 5000;
  private url: string = "http://localhost";
  private socket: Socket;

  // Game objects
  private balls: Phaser.Physics.Arcade.Sprite[] = new Array(0); // ball info
  private table: Phaser.Physics.Arcade.Image; // table image

  // Debug
  private log: Logger = new Logger();


  public make_ball_packet(): BallPacket[] {
    var ret: BallPacket[] = new Array(0);
    for (let i = 1; i <= 15; i++) {
      let tmp = this.balls[i]
      ret[i] = (new BallPacket(tmp.x, tmp.y, tmp.body.velocity.x, tmp.body.velocity.y));
    }

    return ret;
  }
  public expand_ball_packet(pack: BallPacket[]) {
    for (let i = 1; i <= 15; i++) {
      let b = this.balls[i], p = pack[i]; b.x = p.x; b.y = p.y;
      b.setVelocityX(p.vx);
      b.setVelocityY(p.vy);
    }
  }

  public send_packet(c: CommandToServer) {
    this.socket.emit("ToServerCommand", c);
  }

  public receive_packet(c: CommandToClient) { // receive hook
    this.log.deb(c);
    switch (c.cmd) {
      case "ServerWaiting": {
        this.log.log_in("Wait other players", Level.Notice);
        break;
      }
      case "PrepareStart": { // initialize request for server.
        this.send_packet({ cmd: "RequestParameter" });
        this.log.deb("sent request packet.");
        break;
      }
      case "ReplyParameter": {
        this.log.deb("got parameter");
        this.log.deb(c.restit);
        this.log.deb(c.drag);
        break;
      }
    }
  }

  preload(): void {
    this.socket = io(`${this.url}:${this.port}`);
    this.log.log_in(`connecting to ${this.url}:${this.port}`, Level.Notice);

    this.load.image('table', 'assets/table.png');
    for (let i = 1; i <= 15; i++) {
      // load ball image. be carefull to 1-indexed.
      this.load.image(`ball${i}`, `assets/billiards_ball${i.toString().padStart(2, "0")}.png`);
    }
    this.load.image(`white`, `assets/billiards_ball_white.png`);
    this.load.image(`white_red`, `assets/billiards_ball_white_red.png`);
    this.log.log_in("Loaded images", Level.Notice);

    var sock = this.socket;
    var th = this;
    this.input.keyboard.addKey("T").on("down", function () {
      sock.emit("coordinate", th.make_ball_packet());
    });
    this.log.log_in("Application configuration are done", Level.Notice);

    this.socket.on("ToClientCommand", (c: CommandToClient) => {
      this.receive_packet(c);
    });
  }

  // This methods initialize balls, colliders, and game informations.
  private initialize() {
    // create table WITHOUT collider.
    this.table = this.physics.add.image(400, 400, 'table');

    // create balls
    for (let i = 1; i <= 9; i++) {
      // let obj = this.physics.add.sprite(get_int(this.table.x - this.table.width / 2 + 10, this.table.x + this.table.width / 2 - 10), get_int(this.table.y - this.table.height / 2 + 10, this.table.y + this.table.height / 2 - 10), `ball${ i }`).refreshBody(); // random
      let coord = InitRelativeCoordinates[i];
      coord[0] += 400 - 100;
      coord[1] += 400;

      let obj = this.physics.add.sprite(coord[0], coord[1], `ball${i}`).refreshBody();

      obj = obj.setDisplaySize(30, 30);
      obj.setCircle(65, 5, 5);
      obj.setCollideWorldBounds(true)
      obj.setDamping(true);

      obj.setBounce(this.restit_param); // e
      obj.setDragX(this.drag_param);
      obj.setDragY(this.drag_param);

      this.balls[i] = obj;
    }
    for (let i = 1; i <= 9; i++) {
      for (let j = 1; j <= 9; j++) {
        if (i == j) {
          continue;
        }
        // collide with each other.
        this.physics.add.collider(this.balls[i], this.balls[j]);
      }
    }

    // create table
    let group = this.physics.add.staticGroup();
    group.add(this.add.zone(this.table.x, this.table.y - this.table.height / 2 - 10, this.table.width, 21)) // Celling
    group.add(this.add.zone(this.table.x - this.table.width / 2 - 10, this.table.y, 21, this.table.height)) // Left wall
    group.add(this.add.zone(this.table.x, this.table.y + this.table.height / 2 + 10, this.table.width, 21)); // Floor
    group.add(this.add.zone(this.table.x + this.table.width / 2 + 10, this.table.y, 21, this.table.height)); // Right wall

    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.balls[i], group);
    }

    let white = this.physics.add.sprite(400 + 100, 400, `white`).refreshBody();
    white = white.setDisplaySize(30, 30);
    white.setCircle(65, 5, 5);
    white.setCollideWorldBounds(true)

    white.setBounce(this.restit_param); // e
    white.setDragX(this.drag_param);
    white.setDragY(this.drag_param);

    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.balls[i], white);
    }
    this.physics.add.collider(white, group);

    this.input.keyboard.addKey("S").on("down", function () {
      white.setVelocityX(-1000);
    });
  }

  create(): void {
    this.initialize();
  }

  update(): void {
  }
}
