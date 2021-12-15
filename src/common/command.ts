import { BallPacket } from "./field";

export type CommandToClient =
  { cmd: "ServerWaiting" } |
  { cmd: "PrepareStart" } |
  { cmd: "ReplyParameter", restit: number, drag: number } |
  { cmd: "ServerReady" } |
  { cmd: "GetCoordinate" };

export type CommandToServer =
  { cmd: "RequestParameter" } |
  { cmd: "ClientReady" } |
  { cmd: "RequestGameStatus" } |
  { cmd: "BallCoordinate", packet: BallPacket[] };
