import { AiSkill } from "../types";
import { createScriptSkill } from "./createScript";
import { analyzeScriptSkill } from "./analyzeScript";
import { rewriteScriptSkill } from "./rewriteScript";
import { videoDissectSkill } from "./videoDissect";
import { assetPromptSkill } from "./assetPromptSkill";
import { shotPromptSkill } from "./shotPromptSkill";
import { sixViewSkill } from "./sixView";
import { scenePlanSkill } from "./scenePlan";
import { gridStoryboardSkill } from "./gridStoryboard";
import { officePitchDeckSkill } from "./officePitchDeck";
import { officeAdScriptSkill } from "./officeAdScript";
import { officeBriefProposalSkill } from "./officeBriefProposal";
import { dnaSkill } from "./dnaSkill";
import { assetLibrarySkill } from "./assetLibrarySkill";

// Assign categories for UI grouping and processing
createScriptSkill.category = "text";
analyzeScriptSkill.category = "text";
rewriteScriptSkill.category = "text";
videoDissectSkill.category = "video";
assetPromptSkill.category = "text";
shotPromptSkill.category = "text";
sixViewSkill.category = "image";
scenePlanSkill.category = "image";
gridStoryboardSkill.category = "image";
officePitchDeckSkill.category = "text";
officeAdScriptSkill.category = "text";
officeBriefProposalSkill.category = "text";
dnaSkill.category = "text";
assetLibrarySkill.category = "text";

export {
  createScriptSkill,
  analyzeScriptSkill,
  rewriteScriptSkill,
  videoDissectSkill,
  assetPromptSkill,
  shotPromptSkill,
  sixViewSkill,
  scenePlanSkill,
  gridStoryboardSkill,
  officePitchDeckSkill,
  officeAdScriptSkill,
  officeBriefProposalSkill,
  dnaSkill,
  assetLibrarySkill,
};

export const SYSTEM_SKILLS: AiSkill[] = [
  {
    id: "general",
    name: "🧠 意图引导",
    desc: "拆解、分配、串联多个AI能力",
    instruction: "你是一位精通协同、项目、创意和规划 of AI 助手。请协助团队进行分析、解答疑问 or 整理创意概念。请尽量用亲切、靠谱、专业的语气回答。",
    icon: "🧠",
    isSystem: true,
    isInstalled: true,
    isPublic: true,
    category: "text",
  },
  createScriptSkill,
  analyzeScriptSkill,
  rewriteScriptSkill,
  videoDissectSkill,
  assetPromptSkill,
  shotPromptSkill,
  sixViewSkill,
  scenePlanSkill,
  gridStoryboardSkill,
  officePitchDeckSkill,
  officeAdScriptSkill,
  officeBriefProposalSkill,
  dnaSkill,
  assetLibrarySkill,
];
