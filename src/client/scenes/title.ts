import { io } from 'socket.io-client';

import * as field from "../../common/field";

export class TitleScene extends Phaser.Scene {

  constructor() {
    super({
      key: "TitleScene"
    })
  }

  //本来はこのメソッドで、画像ファイルなどのロード
  preload(): void {

    const port = 5000;
    const socket = io(`http://localhost:${port}`, {});
  }

}



