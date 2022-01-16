import { TABLE_XCENTER, TABLE_YCENTER, BALL_WIDHT, BALL_HEIGHT, check_twice_call, InitRelativeCoordinates, Logger, Level, PocketRelativeCoordinate } from "../../common/my_util"
import { CommandToServer, CommandToClient } from "../../common/command"
import { Socket } from "socket.io-client"
import { BallPacket } from "../../common/field";

export class MainScene extends Phaser.Scene {
  constructor() {
    super({
      key: "MainScene",
      active: false
    })
  }

  init(data: { url: string, port: number, sock: Socket }): void {
    this.url = data.url;
    this.port = data.port;
    this.socket = data.sock;
  }

  // Parameters
  private restit_param = 0.95; // default setting ( overwrote by server )
  private drag_param = 0.7; // default settting ( overwrote by server )

  // Communications
  private port: number | undefined = undefined;
  private url: string | undefined = undefined;
  private socket: Socket | undefined = undefined;

  // Game objects
  private balls: Phaser.Physics.Arcade.Sprite[] = new Array(0); // ball info
  private pockets: Phaser.Physics.Arcade.Sprite[] = new Array(0);
  private white: Phaser.Physics.Arcade.Sprite;
  private table: Phaser.Physics.Arcade.Image; // table image

  // Debug
  private log: Logger = new Logger();
  private client_only: boolean = true;

  // Normality
  private got_parameter_flag: boolean = false;

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
    if (this.socket == undefined) {
      this.log.log_in("this.socket is not define.", Level.Critical);
      return;
    }
    this.socket.emit("ToServerCommand", c);
  }

  public receive_packet(c: CommandToClient) { // receive hook
    switch (c.cmd) {
      case "ServerWaiting": {
        if (check_twice_call()) {
          this.log.log_in("got ServerWaiting twice", Level.Warning);
        }

        this.log.log_in("Wait other players", Level.Notice);
        break;
      }
      case "PrepareStart": { // initialize request for server.
        if (check_twice_call()) {
          this.log.log_in("got PrepareStart twice", Level.Warning);
        }

        this.send_packet({ cmd: "RequestParameter" });
        this.log.deb("sent request packet.");
        break;
      }
      case "ReplyParameter": {
        if (check_twice_call()) {
          this.log.log_in("got ReplyParameter twice", Level.Warning);
        }

        this.got_parameter_flag = true;
        this.log.deb("got parameter");
        this.log.deb(`parameter restit set to ${c.restit}`);
        this.log.deb(`parameter restit set to ${c.drag}`);
        break;
      }
    }
  }

  preload(): void {
    //this.socket = io(`${this.url}:${this.port}`);
    //this.log.log_in(`connecting to ${this.url}:${this.port}`, Level.Notice);

    if (!this.client_only) { // network settings
      if (this.url == undefined) {
        this.log.log_in("this.url is not define.", Level.Critical);
        return;
      }
      if (this.port == undefined) {
        this.log.log_in("this.port is not define.", Level.Critical);
        return;
      }
      if (this.socket == undefined) {
        this.log.log_in("this.socket is not define.", Level.Critical);
        return;
      }

      var sock = this.socket;
      var th = this;
      this.input.keyboard.addKey("T").on("down", function () {
        sock.emit("coordinate", th.make_ball_packet());
      });
      this.log.log_in("Application configuration are done", Level.Notice);

      this.socket.on("ToClientCommand", (c: CommandToClient) => {
        this.receive_packet(c);
      });

      this.send_packet({ cmd: "ClientListenerReady" });
    }


    this.load.image('table', 'assets/table.png');
    for (let i = 1; i <= 15; i++) {
      // load ball image. be carefull to 1-indexed.
      this.load.image(`ball${i}`, `assets/billiards_ball${i.toString().padStart(2, "0")}.png`);
    }
    this.load.image(`white`, `assets/billiards_ball_white.png`);
    this.load.image(`white_red`, `assets/billiards_ball_white_red.png`);

    this.load.image(`pocket`, `assets/pocket.png`);

    this.log.log_in("Loaded images", Level.Notice);
  }

  // This methods initialize balls, colliders, and game informations.
  private initialize() {
    // create table WITHOUT collider.
    this.table = this.physics.add.image(TABLE_XCENTER, TABLE_YCENTER, 'table');
    console.log(this.table.width);
    console.log(this.table.height);

    // create balls
    for (let i = 1; i <= 9; i++) {
      // let obj = this.physics.add.sprite(get_int(this.table.x - this.table.width / 2 + 10, this.table.x + this.table.width / 2 - 10), get_int(this.table.y - this.table.height / 2 + 10, this.table.y + this.table.height / 2 - 10), `ball${ i }`).refreshBody(); // random
      let coord = InitRelativeCoordinates[i];
      coord[0] += TABLE_XCENTER - 100;
      coord[1] += TABLE_YCENTER;

      let obj = this.physics.add.sprite(coord[0], coord[1], `ball${i}`).refreshBody();

      obj = obj.setDisplaySize(BALL_WIDHT, BALL_HEIGHT);
      obj.setCircle(65, 5, 5);
      obj.setCollideWorldBounds(true)
      obj.setDamping(true);

      obj.setBounce(this.restit_param); // e
      obj.setDragX(this.drag_param);
      obj.setDragY(this.drag_param);

      this.balls[i] = obj;
    }

    // create white balls
    this.white = this.physics.add.sprite(TABLE_XCENTER + 100, TABLE_YCENTER, `white`).refreshBody();
    this.white = this.white.setDisplaySize(BALL_WIDHT, BALL_HEIGHT);
    this.white.setCircle(65, 5, 5);
    this.white.setCollideWorldBounds(true)

    this.white.setBounce(this.restit_param); // e
    this.white.setDragX(this.drag_param);
    this.white.setDragY(this.drag_param);

    // create pockets
    for (let i = 0; i < 6; i++) {
      let tmp = this.pockets[i] = this.physics.add.sprite(this.table.x + PocketRelativeCoordinate[i][0], this.table.y + PocketRelativeCoordinate[i][1], `pocket`);
      tmp.setDisplaySize(this.balls[1].displayWidth * 2, this.balls[1].displayHeight * 2);
      tmp.setImmovable(true);

      if (tmp.displayWidth != tmp.displayHeight) {
        this.log.log_in("Pocket image is not regular", Level.Warning);
      }
      tmp.setCircle(tmp.width / 4, tmp.width / 4, tmp.height / 4);
    }

    // create table
    let group = this.physics.add.staticGroup();
    group.add(this.add.zone(this.table.x, this.table.y - this.table.height / 2 - 10, this.table.width, 21)) // Celling
    group.add(this.add.zone(this.table.x - this.table.width / 2 - 10, this.table.y, 21, this.table.height)) // Left wall
    group.add(this.add.zone(this.table.x, this.table.y + this.table.height / 2 + 10, this.table.width, 21)); // Floor
    group.add(this.add.zone(this.table.x + this.table.width / 2 + 10, this.table.y, 21, this.table.height)); // Right wall

    // collide iwtheach other
    for (let i = 1; i <= 9; i++) {
      for (let j = 1; j <= 9; j++) {
        if (i == j) {
          continue;
        }
        this.physics.add.collider(this.balls[i], this.balls[j]);
      }
    }

    // balls and pockets
    for (let pocket_index = 0; pocket_index < 6; pocket_index++) {
      // TODO: delete collided balls
      this.physics.add.collider(this.pockets[pocket_index], this.white, function () {
        console.log("scratch!");
      });
      for (let ball_index = 1; ball_index <= 9; ball_index++) {
        this.physics.add.collider(this.pockets[pocket_index], this.balls[ball_index], function () {
          console.log("pocket!");
        });
      }
    }

    // balls and wall
    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.balls[i], group);
    }
    this.physics.add.collider(this.white, group);

    // ball and white
    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.white, this.balls[i]);
    }


    let bind_white = this.white;
    this.input.keyboard.addKey("A").on("down", function () {
      bind_white.setVelocityX(-1000);
    });
    this.input.keyboard.addKey("D").on("down", function () {
      bind_white.setVelocityX(1000);
    });
    this.input.keyboard.addKey("W").on("down", function () {
      bind_white.setVelocityY(-1000);
    });
    this.input.keyboard.addKey("S").on("down", function () {
      bind_white.setVelocityY(1000);
    });
  }

  create(): void {
    this.initialize();
  }

  update(): void {
  }
}
