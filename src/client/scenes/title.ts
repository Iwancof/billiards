import { io } from 'socket.io-client';

export class TitleScene extends Phaser.Scene {

  constructor() {
    super({
      key: "TitleScene",
      active: true,
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
          const ip = element.getChildByName("ip") as HTMLInputElement;
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

          this.message.text = "Connecting....";

          console.log(`${ip.value}:${port.value}`);
          this.scene.start("MainScene", { ip: ip, port: port });
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



