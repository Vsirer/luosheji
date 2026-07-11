import { AiSkill } from "../../skills/types";
import { perspectiveSimSkill } from "./perspectiveSim";
import { pointAndShootSkill } from "./pointAndShoot";
import { cameraControlSkill } from "./cameraControl";
import { panoramaSkill } from "./panorama";

// Assign categories for UI grouping and processing
panoramaSkill.category = "image";

export {
  perspectiveSimSkill,
  pointAndShootSkill,
  cameraControlSkill,
  panoramaSkill,
};

export const SYSTEM_PLUGINS: AiSkill[] = [
  perspectiveSimSkill,
  pointAndShootSkill,
  cameraControlSkill,
  panoramaSkill,
];
