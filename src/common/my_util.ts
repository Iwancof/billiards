export function get_int(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

const BallSize = 27;
export const InitRelativeCoordinates: [number, number][] = [];
InitRelativeCoordinates[1] = [BallSize * 2, 0];
InitRelativeCoordinates[2] = [0, BallSize];
InitRelativeCoordinates[3] = [BallSize * (-2), 0];
InitRelativeCoordinates[4] = [0, -BallSize];
InitRelativeCoordinates[5] = [BallSize, BallSize / 2];
InitRelativeCoordinates[6] = [BallSize, - BallSize / 2];
InitRelativeCoordinates[7] = [-BallSize, BallSize / 2];
InitRelativeCoordinates[8] = [-BallSize, -BallSize / 2];
InitRelativeCoordinates[9] = [0, 0];

export const TABLE_XCENTER: number = 400;
export const TABLE_YCENTER: number = 400;

export const BALL_WIDHT: number = 30;
export const BALL_HEIGHT: number = 30;

const FieldWidth = 691;
const FieldHeight = 361;
export const PocketRelativeCoordinate: [number, number][] = [];
/*
 *  0       1        2
 *
 *    balls
 *
 *  3       4        5
 */


PocketRelativeCoordinate[0] = [-FieldWidth / 2, -FieldHeight / 2];
PocketRelativeCoordinate[1] = [0, -FieldHeight / 2];
PocketRelativeCoordinate[2] = [FieldWidth / 2, -FieldHeight / 2];
PocketRelativeCoordinate[3] = [-FieldWidth / 2, FieldHeight / 2];
PocketRelativeCoordinate[4] = [0, FieldHeight / 2];
PocketRelativeCoordinate[5] = [FieldWidth / 2, FieldHeight / 2];

/*
    at get_call_stack (/home/iwancof/WorkSpace/game_create_project/game/src/common/my_util.ts:19:11)
    at Logger.log_in (/home/iwancof/WorkSpace/game_create_project/game/src/common/my_util.ts:56:20)
    at new GameInfo (/home/iwancof/WorkSpace/game_create_project/game/src/server/back_end.ts:34:14)
*/


function get_call_stack(): [string, string] {
  let search_str: string;
  let func_str: string;
  let file_str: string;
  let index: number
  try {
    throw new Error("DUMMY");
  } catch (e: any) {
    if (typeof window === 'undefined') { // server side
      search_str = "at\ .*\ \(.*\)";
      func_str = "[^at\ ][^\(]*";
      file_str = "\/.*:[0-9]*:[0-9]*"
      index = 3;
    } else { // client side
      search_str = ".*@.*", "g";
      func_str = ".*@";
      file_str = "\/.*\?.*";
      index = 2;
    }
    const search = new RegExp(search_str, "g");
    const ret = search.exec(e.stack.split("\n")[index]);

    if (ret == null) {
      throw new Error("Could not get information line.");
    }

    const reg_func_name = new RegExp(func_str).exec(ret[0]);
    if (reg_func_name == null) {
      throw new Error("Could not get source code line.");
    }
    const func_name = reg_func_name[0].slice(0, -1);

    const reg_file_det = new RegExp(file_str).exec(ret[0]);
    if (reg_file_det == null) {
      throw new Error("Could not get source code line.");
    }
    const file_det = reg_file_det[0].slice(reg_file_det[0].lastIndexOf('/') + 1, -1);

    return [func_name, file_det];
  }
}

export const Level = { Debug: 0, Notice: 1, Warning: 2, Error: 3, Critical: 4 } as const;
const LevelName: string[] = ["Debug", "Notice", "Warning", "Error", "Critical"];


export class Logger { // Simple Logger
  public log_level: number = Level.Debug;
  public log_in(msg: { toString(): string }, l: number) {
    const [f, d] = get_call_stack();
    if (this.log_level <= l) {
      console.log(`[${LevelName[l].padEnd(8, " ")}!${f}@${d}]: ${msg.toString()}`);
    }
  }
  public deb(msg: { toString(): string }) {
    const [f, d] = get_call_stack();
    if (this.log_level <= Level.Debug) {
      console.log(`[${LevelName[Level.Debug].padEnd(8, " ")}!${f}@${d}]: ${msg.toString()}`);
    }
  }
}

let caller_set = new Set<string>();
export function check_twice_call(): boolean {
  const [f, d] = get_call_stack();
  const ret = caller_set.has(`${[f, d]}`);
  caller_set.add(`${[f, d]}`);

  return ret;
}


