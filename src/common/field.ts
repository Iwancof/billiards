
export class BallCoordinate {
  x: number;
  y: number;
  vx: number;
  vy: number;

  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }
}
export type BallPacket = BallCoordinate | null;
export type Turn = 1 | 2;

export type SyncPacket = {
  balls: BallPacket[],
  pockets: number[],
  fouls: FoulType[],
};

export type FoulType = "NoHit" | "WhiteOut";

