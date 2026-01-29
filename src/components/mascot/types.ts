export type Expression = "neutral" | "happy" | "alert" | "thinking" | "wink";

export type Pose = "idle" | "scan" | "stamp" | "wave" | "point";

export type MascotState =
  | "offline"
  | "online"
  | "scanning"
  | "alert"
  | "presenting";

export type MrMapsProps = {
  expression?: Expression;
  pose?: Pose;
  state?: MascotState;
  size?: number;
  className?: string;
};
