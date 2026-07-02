import { AiSkill } from "../../skills/types";
import { perspectiveSimSkill } from "./perspectiveSim";
import { pointAndShootSkill } from "./pointAndShoot";
import { cameraControlSkill } from "./cameraControl";

export {
  perspectiveSimSkill,
  pointAndShootSkill,
  cameraControlSkill,
};

export const SYSTEM_PLUGINS: AiSkill[] = [
  perspectiveSimSkill,
  pointAndShootSkill,
  cameraControlSkill,
];
