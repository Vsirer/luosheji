import { AiSkill } from "../../skills/types.ts";
import { perspectiveSimSkill } from "./perspectiveSim.ts";
import { pointAndShootSkill } from "./pointAndShoot.ts";
import { cameraControlSkill } from "./cameraControl.ts";
import { panoramaSkill } from "./panorama.ts";

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
