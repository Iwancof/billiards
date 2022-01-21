import { TABLE_XCENTER, TABLE_YCENTER, BALL_WIDHT, BALL_HEIGHT, check_twice_call, InitRelativeCoordinates, Logger, Level, PocketRelativeCoordinate, EffectConditionController } from "../../common/my_util"
import { CommandToServer, CommandToClient } from "../../common/command"
import { Socket } from "socket.io-client"
import { BallCoordinate, BallPacket, FoulType, Turn } from "../../common/field";
import * as mobile from "is-mobile";

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
  private stop_threshold = 2;

  // Communications
  private port: number | undefined = undefined;
  private url: string | undefined = undefined;
  private socket: Socket | undefined = undefined;
  private temporary_pockets: Set<number> = new Set(); // initialize per turn.
  private temporary_fouls: Set<FoulType> = new Set(); // initialize per turn with "NoHit". 
  private whoami: Turn;

  // Game objects
  private balls: (Phaser.Physics.Arcade.Sprite | null)[] = new Array(0); // ball info
  private pockets: Phaser.Physics.Arcade.Sprite[] = new Array(0);
  private white: Phaser.Physics.Arcade.Sprite | null;
  private shadow_white: Phaser.Physics.Arcade.Sprite | null = null;
  private table: Phaser.Physics.Arcade.Image; // table image
  private message: Phaser.GameObjects.Text;
  private line_g: Phaser.GameObjects.Graphics;
  private is_shooting: boolean = false;
  private table_object_group: Phaser.Physics.Arcade.StaticGroup;
  private pointer: Phaser.Input.Pointer;

  // Debug
  private log: Logger = new Logger();
  private client_only: boolean = false;

  // Normality
  private client_ready_effect: EffectConditionController<"ObjectInitialized" | "GotParameterFromServer"> = new EffectConditionController(() => {
    let init_flag = false;
    let param_flag = false;
    return (x) => {
      this.log.deb("effect controller's check got" + x);
      if (x == "GotParameterFromServer") {
        param_flag = true;
      }
      if (x == "ObjectInitialized") {
        init_flag = true;
      }
      return init_flag && param_flag;
    }
  }, () => {
    this.send_packet({ cmd: "ClientReady" });
  });

  public make_ball_packet(): BallPacket[] {
    // make ball packet.
    // return [white, ball1, ..., ball15]
    // if ball is null(this is, the ball is packeted), element is null.

    var ret: BallPacket[] = new Array(null);
    if (this.white != null) {
      ret[0] = new BallCoordinate(this.white.x, this.white.y, this.white.body.velocity.x, this.white.body.velocity.y);
    }

    for (let i = 1; i <= 15; i++) {
      let tmp = this.balls[i];
      if (tmp == null) {
        ret.push(null);
        continue;
      }
      ret[i] = new BallCoordinate(tmp.x, tmp.y, tmp.body.velocity.x, tmp.body.velocity.y);
    }

    return ret;
  }

  public expand_ball(local: Phaser.Physics.Arcade.Sprite | null, remote: BallPacket | null): boolean {
    // return true if ball recreated.
    if (local == null) {
      if (remote != null) {
        // local ball is packeted, but remote ball is not packeted.
        return true;
      }
      return false; // ball is already packeted.
    }
    if (remote == null) {
      // local is not null, and remote is null. so, other player packets the ball. we update it.
      local.destroy();
      return false;
    }
    // both are not null. we update the ball coordinate and velocity.
    local.x = remote.x;
    local.y = remote.y;

    local.body.velocity.x = remote.vx;
    local.body.velocity.y = remote.vy;

    return false;
  }
  public expand_ball_packet(pack: BallPacket[]) {
    this.log.deb("syncing: " + Array.from(this.temporary_pockets));
    // expand ball packet that makes by make_ball_packet()
    // to [white, ball1, ..., ball15]

    if (pack.length != 16) {
      this.log.log_in("ball packet length is not 16", Level.Error);
      return;
    }

    if (this.expand_ball(this.white, pack[0])) {
      this.initialize_white();
      this.initialize_white_colliders();
    }
    for (let i = 1; i <= 15; i++) {
      if (this.expand_ball(this.balls[i], pack[i])) {
        this.log.log_in("recreate normal ball.", Level.Error);
      }
    }
  }

  public send_packet(c: CommandToServer) {
    if (this.socket == undefined) {
      this.log.log_in("this.socket is not define.", Level.Critical);
      return;
    }
    console.log(`socket is ${this.socket} and send ${JSON.stringify(c)}`);
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

        this.log.deb("got parameter");
        this.log.deb(`parameter restit set to ${c.restit}`);
        this.log.deb(`parameter restit set to ${c.drag}`);
        this.log.deb(`parameter restit set to ${c.stop_threshold}`);
        this.log.log_in(`your turn is ${c.turn}`, Level.Notice);

        this.restit_param = c.restit;
        this.drag_param = c.drag;
        this.stop_threshold = c.stop_threshold;
        this.whoami = c.turn;

        this.client_ready_effect.check("GotParameterFromServer")
        this.log.log_in("client is ready!", Level.Notice);
        break;
      }
      case "GetCoordinate": {
        this.sync_coordinate();
        break;
      }
      case "UpdateCoordinate": {
        this.expand_ball_packet(c.packet);
        break;
      }
      case "YourTurn": {
        this.log.deb("your turn");
        this.message.text = "Your turn";

        this.temporary_pockets = new Set();
        this.temporary_fouls = new Set();
        this.temporary_fouls.add("NoHit");
        // if white collide balls, "NoHit" will be removed.

        this.enable_shot();
        break;
      }
      case "InternalServerError": {
        this.log.log_in("InternalServerError", Level.Critical);
        this.message.text = "Error occured!, error is " + c.err;
        break;
      }
      case "GameEnd": {
        let winner = c.winner;
        if (winner == null) {
          this.message.text = "Draw!";
        } else if (winner == this.whoami) {
          this.message.text = "You win!";
        } else {
          this.message.text = "You lose!";
        }
        break;
      }
    }
  }

  private sync_coordinate() {
    this.send_packet({ cmd: "SyncCoordinate", packet: { balls: this.make_ball_packet(), pockets: Array.from(this.temporary_pockets), fouls: Array.from(this.temporary_fouls) } });
  }

  private finish_turn() {
    // this calls when all balls stop. if white ball is outed, this means foul.
    // and sync ball coordinate to server.

    let fouls: FoulType[] = []
    if (this.white == null) {
      // This player foul the game.
      this.initialize_white();
      this.initialize_white_colliders();
      fouls.push("NoHit");
    }

    this.sync_coordinate();
    this.send_packet({ cmd: "FinishTurn" });

    this.message.text = "wait for other players";

    this.log.deb("turn end");
  }
  private is_stop_object(obj: Phaser.Physics.Arcade.Sprite | null) {
    if (obj == null) {
      return true;
    }
    let abs_vx = Math.abs(obj.body.velocity.x);
    let abs_xy = Math.abs(obj.body.velocity.y);

    return abs_vx < this.stop_threshold && abs_xy < this.stop_threshold;
  }

  private is_field_stop(): boolean {
    if (!this.is_stop_object(this.white)) {
      return false;
    }
    for (let i = 1; i <= 15; i++) {
      let tmp = this.balls[i];
      if (!this.is_stop_object(tmp)) {
        return false;
      } else {
        // this.log.deb("ball " + i + " is stop");
      }
    }
    return true;
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

    if (mobile.isMobile()) {
      this.pointer = this.input.pointer1;
    } else {
      this.pointer = this.input.mousePointer;
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

    this.message = this.add.text(80, 120, " ~Billilard~ ", { font: '30px Courier', fontStyle: '#ffffff' });
  }

  private finalize_shadow_white() {
    if (this.shadow_white == null) {
      this.log.log_in("attempt to finalize shadow_white, but it is null", Level.Warning);
      return;
    }

    this.shadow_white.destroy();
    this.shadow_white = null;
    this.line_g.clear();
  }
  private shot_white_with_shadow() {
    if (this.shadow_white == null || this.white == null) {
      this.log.log_in("attempt to shot white with shadow, but white or shadow_white is null", Level.Warning);
      return;
    }

    let power = this.get_distance_between_white_and_shadow() * 3;
    let angle = this.get_angle_between_white_and_shadow();

    let vx = power * Math.cos(angle);
    let vy = power * Math.sin(angle);

    this.white.setVelocity(-vx, -vy);
  }

  private initialize_shadow_white() {
    // create shadow white ball.
    // this follows mouse position.

    if (this.shadow_white != undefined) {
      return;
    }

    this.shadow_white = this.physics.add.sprite(this.input.x, this.input.y, `white_red`).refreshBody();
    this.shadow_white = this.shadow_white.setDisplaySize(BALL_WIDHT, BALL_HEIGHT);
    this.shadow_white.setCircle(65, 5, 5);
    this.shadow_white.alpha = 0.5;
    this.shadow_white.setInteractive();
  }
  private get_distance_between_white_and_shadow(): number {
    if (this.white == null || this.shadow_white == null) {
      return 0;
    }
    return this.shadow_white.body.position.distance(this.white.body.position);
  }
  private get_angle_between_white_and_shadow(): number {
    if (this.white == null || this.shadow_white == null) {
      return 0;
    }
    return Math.atan2(this.shadow_white.body.position.y - this.white.body.position.y, this.shadow_white.body.position.x - this.white.body.position.x);
  }

  private render_shadow_to_white() {
    if (this.shadow_white == undefined || this.white == undefined) {
      this.log.log_in('attempt to render shadow to white, but white or shadow is undefined', Level.Warning);
      return;
    }

    this.line_g.clear(); // clear previous line.
    this.line_g.lineStyle(this.get_distance_between_white_and_shadow() / 10, 0xff0000); // thickness is calculated by distance between shadow and white.
    this.line_g.lineBetween(this.white.x, this.white.y, this.shadow_white.x, this.shadow_white.y);
  }

  private initialize_white() {
    // create white balls
    this.white = this.physics.add.sprite(TABLE_XCENTER + 100, TABLE_YCENTER, `white`).refreshBody();
    this.white = this.white.setDisplaySize(BALL_WIDHT, BALL_HEIGHT);
    this.white.setCircle(65, 5, 5);
    this.white.setCollideWorldBounds(true)
    this.white.setDamping(true);
    this.white.setInteractive();

    this.white.setBounce(this.restit_param); // e
    this.white.setDragX(this.drag_param);
    this.white.setDragY(this.drag_param);
  }
  private initialize_white_colliders() {
    if (this.white == null) {
      this.log.log_in("attempt to initialize white colliders, but white is null", Level.Error);
      return;
    }
    this.physics.add.collider(this.white, this.table_object_group);
    // ball and white
    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.white, this.balls[i] as Phaser.Physics.Arcade.Sprite, () => {
        // white collided other balls. so "NoHit" foul well be delete from fouls.
        this.temporary_fouls.delete("NoHit");
      });
    }

    for (let pocket_index = 0; pocket_index < 6; pocket_index++) {
      this.physics.add.collider(this.pockets[pocket_index], this.white, () => {
        this.temporary_fouls.add("WhiteOut");
        if (this.white == null) {
          this.log.log_in("white is null", Level.Critical);
          return;
        }
        this.white.destroy();
        this.white = null;
      });
    }

    this.input.keyboard.addKey("A").on("down", () => {
      if (this.white == null) {
        this.log.log_in("white is null", Level.Warning);
        return;
      }
      this.white.setVelocityX(-1000);
    });
    this.input.keyboard.addKey("D").on("down", () => {
      if (this.white == null) {
        this.log.log_in("white is null", Level.Warning);
        return;
      }
      this.white.setVelocityX(1000);
    });
    this.input.keyboard.addKey("W").on("down", () => {
      if (this.white == null) {
        this.log.log_in("white is null", Level.Warning);
        return;
      }
      this.white.setVelocityY(-1000);
    });
    this.input.keyboard.addKey("W").on("down", () => {
      if (this.balls[1] == null) {
        this.log.log_in("white is null", Level.Warning);
        return;
      }
      this.balls[1].setVelocityY(-1000);
    });
    this.input.keyboard.addKey("S").on("down", () => {
      if (this.white == null) {
        this.log.log_in("white is null", Level.Warning);
        return;
      }
      this.white.setVelocityY(1000);
    });
  }
  private enable_shot() {
    if (this.white == null) {
      this.log.log_in("white is null when mouse settings", Level.Error);
      return;
    }
    this.log.deb("event listener is set");
    this.white.on("pointerdown", () => { // hold white ball
      if (this.white == null) {
        this.log.log_in("white is null when event occured. over", Level.Error);
        return;
      }
      this.white.setTexture('white_red'); // change texture
      this.initialize_shadow_white(); // create shadow white ball.
      // this shadow white ball follows mouse position. see update functions.

      this.input.on("pointerup", () => { // free shadow white ball
        this.shot_white_with_shadow(); // shot

        this.sync_coordinate();
        // syncronize white shot velocity to server.
        // this is not necessary, but it is good to have.

        this.finalize_shadow_white(); // and delete shadow
        this.white?.setTexture('white'); // restore texture
        this.is_shooting = true;

        this.input.off("pointerup"); // disable itself.
      });
    }, this);
  }

  // This methods initialize balls, colliders, and game informations.
  private initialize() {
    // create table WITHOUT collider.
    this.table = this.physics.add.image(TABLE_XCENTER, TABLE_YCENTER, 'table');
    this.table.on("pointerover", () => {
      this.log.deb("mouse over table");
      this.table.setTint(0x00ff00);
    });

    this.line_g = this.add.graphics();

    // create balls
    let sample_ball;
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

      sample_ball = this.balls[i] = obj;
    }

    if (sample_ball == undefined) {
      this.log.log_in("sample_ball is not define.", Level.Critical);
      return;
    }

    // create white balls
    this.initialize_white();
    if (this.white == undefined) {
      this.log.log_in("white is not define.", Level.Critical);
      return;
    }

    // create pockets
    for (let i = 0; i < 6; i++) {
      let tmp = this.pockets[i] = this.physics.add.sprite(this.table.x + PocketRelativeCoordinate[i][0], this.table.y + PocketRelativeCoordinate[i][1], `pocket`);
      tmp.setDisplaySize(sample_ball.displayWidth * 2, sample_ball.displayHeight * 2);
      tmp.setImmovable(true);

      if (tmp.displayWidth != tmp.displayHeight) {
        this.log.log_in("Pocket image is not regular", Level.Warning);
      }
      tmp.setCircle(tmp.width / 4, tmp.width / 4, tmp.height / 4);
    }

    // create table
    let group = this.table_object_group = this.physics.add.staticGroup();
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
        let x = this.balls[i] as Phaser.Physics.Arcade.Sprite;
        let y = this.balls[j] as Phaser.Physics.Arcade.Sprite;
        this.physics.add.collider(x, y);
      }
    }

    // balls and pockets
    for (let pocket_index = 0; pocket_index < 6; pocket_index++) {
      for (let ball_index = 1; ball_index <= 9; ball_index++) {
        this.physics.add.collider(this.pockets[pocket_index], this.balls[ball_index] as Phaser.Physics.Arcade.Sprite, () => {

          this.log.deb("pocket collision, ball_index: " + ball_index);
          this.temporary_pockets.add(ball_index);

          let target_ball = this.balls[ball_index];
          if (target_ball == undefined) {
            this.log.log_in("ball is alreadly destroyed", Level.Critical);
            return;
          }
          target_ball.destroy();
          this.balls[ball_index] = null;
        });
      }
    }

    // balls and wall
    for (let i = 1; i <= 9; i++) {
      this.physics.add.collider(this.balls[i] as Phaser.Physics.Arcade.Sprite, group);
    }

    this.initialize_white_colliders();

    this.client_ready_effect.check("ObjectInitialized");
  }

  create(): void {
    this.initialize();
  }

  update(): void {
    // if (this.shadow_white != undefined && (this.input.mousePointer.isDown || this.input.pointer1.isDown)) {
    if (this.shadow_white != undefined && this.pointer) {
      // this.shadow_white.x = this.input.mousePointer.x;
      // this.shadow_white.y = this.input.mousePointer.y;
      // this.shadow_white.x = this.input.pointer1.x;
      // this.shadow_white.y = this.input.pointer1.y;
      this.shadow_white.x = this.pointer.x;
      this.shadow_white.y = this.pointer.y;

      this.render_shadow_to_white();
    }
    if (this.is_shooting) {
      if (this.is_field_stop()) {
        this.log.deb("field stop");
        this.is_shooting = false;
        this.finish_turn();
      }
    }
  }
}
