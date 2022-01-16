import { BallPacket } from "./field";

export type CommandToClient =
  { cmd: "ServerWaiting", first_player: boolean } |
  { cmd: "ha-Aretz" } |
  { cmd: "PrepareStart" } |
  { cmd: "ReplyParameter", restit: number, drag: number } |
  { cmd: "ServerReady" } |
  { cmd: "GetCoordinate" };

export type CommandToServer =
  { cmd: "RequestParameter" } |
  { cmd: "ClientListenerReady" } |
  { cmd: "ClientReady" } |
  { cmd: "RequestGameStatus" } |
  { cmd: "BallCoordinate", packet: BallPacket[] };
