import "phaser"
import * as title from "./scenes/title";
import * as main from "./scenes/main";

const config: Phaser.Types.Core.GameConfig = {
  title: "billiards",
  version: "0.0.1",
  width: 800,
  height: 800,
  parent: "game",
  type: Phaser.AUTO,
  fps: {
    target: 10,
  },

  dom: {
    createContainer: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: true,
    },
  },

  scene: [title.TitleScene, main.MainScene],
};

export class Game extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
  }
}

window.addEventListener("load", () => {
  var game = new Game(config);
});
