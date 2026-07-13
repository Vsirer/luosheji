import { SkillDefinition } from '../types';

// Import existing skills
import { createScriptSkill } from '../../../skills/definitions/createScript';
import { analyzeScriptSkill } from '../../../skills/definitions/analyzeScript';
import { rewriteScriptSkill } from '../../../skills/definitions/rewriteScript';
import { videoDissectSkill } from '../../../skills/definitions/videoDissect';
import { assetPromptSkill } from '../../../skills/definitions/assetPromptSkill';
import { shotPromptSkill } from '../../../skills/definitions/shotPromptSkill';
import { sixViewSkill } from '../../../skills/definitions/sixView';
import { scenePlanSkill } from '../../../skills/definitions/scenePlan';
import { gridStoryboardSkill } from '../../../skills/definitions/gridStoryboard';
import { officePitchDeckSkill } from '../../../skills/definitions/officePitchDeck';
import { officeAdScriptSkill } from '../../../skills/definitions/officeAdScript';
import { officeBriefProposalSkill } from '../../../skills/definitions/officeBriefProposal';
import { dnaSkill } from '../../../skills/definitions/dnaSkill';
import { assetLibrarySkill } from '../../../skills/definitions/assetLibrarySkill';

// Import existing plugins converting them to skills
import { panoramaSkill } from '../../../plugin/definitions/panorama';
import { cameraControlSkill } from '../../../plugin/definitions/cameraControl';
import { pointAndShootSkill } from '../../../plugin/definitions/pointAndShoot';
import { perspectiveSimSkill } from '../../../plugin/definitions/perspectiveSim';

class SkillRegistryService {
  private skills: Map<string, SkillDefinition> = new Map();

  constructor() {
    this.registerDefaultSkills();
  }

  private registerDefaultSkills() {
    const list: any[] = [
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
      panoramaSkill,
      cameraControlSkill,
      pointAndShootSkill,
      perspectiveSimSkill
    ];

    list.forEach(item => {
      if (item) {
        this.register({
          id: item.id,
          name: item.name,
          description: item.desc || item.description || '',
          instruction: item.instruction || '',
          category: item.category || 'all',
          icon: item.icon,
          isSystem: item.isSystem !== false,
          isInstalled: item.isInstalled !== false,
          isPublic: item.isPublic !== false,
          customOptions: item.customOptions,
          enableUpload: item.enableUpload,
          uploadType: item.uploadType,
          promptLabel: item.promptLabel,
          promptPlaceholder: item.promptPlaceholder,
          metadata: item
        });
      }
    });
  }

  public register(skill: SkillDefinition) {
    this.skills.set(skill.id, skill);
  }

  public unregister(id: string) {
    this.skills.delete(id);
  }

  public get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  public list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  public has(id: string): boolean {
    return this.skills.has(id);
  }
}

export const SkillRegistry = new SkillRegistryService();
export default SkillRegistry;
