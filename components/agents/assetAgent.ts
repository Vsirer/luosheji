import { aiDramaAgent, AI_DRAMA_AGENT_SYSTEM_INSTRUCTION } from "./aiDramaAgent";
import { Asset, Config, PipelineData } from "../../types";

export const ASSET_AGENT_SYSTEM_INSTRUCTION = AI_DRAMA_AGENT_SYSTEM_INSTRUCTION;

export class AssetAgent {
  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = [], styleImageUrl?: string): Promise<Asset[]> {
    return aiDramaAgent.preScanAssets(script, visualStyle, config, existingAssets);
  }

  public fuzzyBindAssets(data: any): PipelineData {
    return aiDramaAgent.fuzzyBindAssets(data);
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, styleImageUrl?: string): Promise<Asset['subAssets']> {
    return aiDramaAgent.generateSingleAssetPrompts(asset, visualStyle, config);
  }

  public getAssetDisplayId(id: string, type: string, assetsList: Asset[]): string {
    return aiDramaAgent.getAssetDisplayId(id, type, assetsList);
  }

  public cleanupAssets(assets: Asset[]): Asset[] {
    return aiDramaAgent.cleanupAssets(assets);
  }

  public cleanPromptText(text: string): string {
    return aiDramaAgent.cleanPromptText(text);
  }

  public async analyzeImageForDNA(imageUrl: string, assetType: string, config?: Config): Promise<any> {
    return { details: {}, suggestedMainPrompt: "" };
  }

  public async generateMainImage(asset: Asset, visualStyle?: string, config?: Config): Promise<{ imageUrl: string }> {
    return { imageUrl: "" };
  }
}

export const assetAgent = new AssetAgent();
