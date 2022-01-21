import { BallPacket, SyncPacket, Turn } from "./field";

export type ErrorCode = "Client time out";

export type CommandToClient =
  { cmd: "ServerWaiting", first_player: boolean } |
  { cmd: "ha-Aretz" } |
  { cmd: "PrepareStart" } |
  { cmd: "ReplyParameter", restit: number, drag: number, stop_threshold: number, turn: Turn } |
  { cmd: "ServerReady" } |
  { cmd: "GetCoordinate" } |
  { cmd: "UpdateCoordinate", packet: BallPacket[] } |
  { cmd: "YourTurn" } |
  { cmd: "InternalServerError", err: ErrorCode } |
  { cmd: "GameEnd", winner: Turn | null };

export type CommandToServer =
  { cmd: "RequestParameter" } |
  { cmd: "ClientListenerReady" } |
  { cmd: "ClientReady" } |
  { cmd: "RequestGameStatus" } |
  { cmd: "SyncCoordinate", packet: SyncPacket } |
  { cmd: "FinishTurn" } |
  { cmd: "InternalClientError", err: ErrorCode }
