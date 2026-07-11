import { directorAgent, DIRECTOR_AGENT_SYSTEM_INSTRUCTION } from "./directorAgent";
import { Asset, Config, PipelineData } from "../../types";

export const ASSET_AGENT_SYSTEM_INSTRUCTION = DIRECTOR_AGENT_SYSTEM_INSTRUCTION;

export class AssetAgent {
  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = [], styleImageUrl?: string): Promise<Asset[]> {
    return directorAgent.preScanAssets(script, visualStyle, config, existingAssets);
  }

  public fuzzyBindAssets(data: any): PipelineData {
    return directorAgent.fuzzyBindAssets(data);
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, styleImageUrl?: string): Promise<Asset['subAssets']> {
    return directorAgent.generateSingleAssetPrompts(asset, visualStyle, config);
  }

  public getAssetDisplayId(id: string, type: string, assetsList: Asset[]): string {
    return directorAgent.getAssetDisplayId(id, type, assetsList);
  }

  public cleanupAssets(assets: Asset[]): Asset[] {
    return directorAgent.cleanupAssets(assets);
  }

  public cleanPromptText(text: string): string {
    return directorAgent.cleanPromptText(text);
  }

  public async analyzeImageForDNA(imageUrl: string, assetType: string, config?: Config): Promise<any> {
    return { details: {}, suggestedMainPrompt: "" };
  }

  public async generateMainImage(asset: Asset, visualStyle?: string, config?: Config): Promise<{ imageUrl: string }> {
    return { imageUrl: "" };
  }
}

export const assetAgent = new AssetAgent();
