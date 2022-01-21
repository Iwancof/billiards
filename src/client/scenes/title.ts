import { CommandToClient } from "../../common/command"
import { io, Manager, Socket } from "socket.io-client"

export class TitleScene extends Phaser.Scene {

  constructor() {
    super({
      key: "TitleScene",
    })
  }

  private message: Phaser.GameObjects.Text;
  preload(): void {
    this.add.text(80, 80, 'Welcome to ' + this.game.config.gameTitle + ".", { font: '30px Courier', fontStyle: '#ffffff' });
    this.message = this.add.text(80, 120, "Enter 'Connect' to play!", { font: '30px Courier', fontStyle: '#ffffff' });
    this.load.html('setting_form', 'assets/text/setting_form.html');
  }

  create(): void {
    var element = this.add.dom(500, 1000).createFromCache('setting_form');
    element.addListener("click")
    element.on("click", (event: any) => {
      const { target } = event;
      if (target instanceof HTMLInputElement) {
        if (target.name == "start_button") {
          const url = element.getChildByName("url") as HTMLInputElement;
          const port = element.getChildByName("port") as HTMLInputElement;

          //  Turn off the click events
          element.removeListener('click');

          //  Tween the login form out
          this.tweens.add({ targets: element.rotate3d, x: 1, w: 90, duration: 3000, ease: 'Power3' });

          this.tweens.add({
            targets: element, scaleX: 2, scaleY: 2, y: 800, duration: 3000, ease: 'Power3',
            onComplete: function () {
              element.setVisible(false);
            }
          });

          this.message.text = "Connecting....\n";

          const sock = io(`ws://${url.value}:${port.value}`, { forceNew: true, autoConnect: false });

          const clear = setTimeout(() => {
            this.message.text = "Can't connect server. Timeout!";
            sock.close();
          }, 5000);

          var waiting_for_other_player = false;

          sock.on("ToClientCommand", (c: CommandToClient) => {
            clearTimeout(clear);
            this.message.text += `got` + c.cmd + "\n";

            if (c.cmd == "ha-Aretz") {
              if (waiting_for_other_player == false) {
                console.log("まってないが");
                this.message.text = "Error! We are not waiting for other player, but got ha-Aretz.";
                throw new Error("unexpected wait flag");
              }
              this.message.text = "Other player is ready.\n";
              console.log("おまたせ。まった？");
              sock.off("ToClientCommand");
              this.scene.start("MainScene", { url: url, port: port, sock: sock });
              return;
            }

            if (c.cmd != "ServerWaiting") {
              console.log(`Invalid command received: ${c.cmd}`);
              sock.close();
              return;
            }

            if (c.first_player) {
              this.message.text = "Waiting for other player...";
              waiting_for_other_player = true
              return; // wait for
            }
            this.message.text = "Other player is ready.\n";

            sock.off("ToClientCommand");
            // ok.
            this.scene.start("MainScene", { url: url, port: port, sock: sock });
            return;
          });

          this.message.text += "listener set.\n";
          sock.connect();
        }
      }
    });

    this.tweens.add({
      targets: element,
      y: 400,
      duration: 3000,
      ease: 'Power3'
    });
  }
}



const getMethods = (obj: object): string[] => {
  const getOwnMethods = (obj: object) =>
    Object.entries(Object.getOwnPropertyDescriptors(obj))
      .filter(([name, { value }]) => typeof value === 'function' && name !== 'constructor')
      .map(([name]) => name)
  const _getMethods = (o: object, methods: string[]): string[] =>
    o === Object.prototype ? methods : _getMethods(Object.getPrototypeOf(o), methods.concat(getOwnMethods(o)))
  return _getMethods(obj, [])
}
