import { imageAgent, IMAGE_AGENT_SYSTEM_INSTRUCTION } from "../components/agents/imageAgent";
import { videoAgent } from "../components/agents/videoAgent";
import { directorAgent } from "../components/agents/directorAgent";
import { assetService } from "./assetService";
import { PipelineData, Asset, Segment, Config, ScriptAnalysis, SmartImageConfig, SmartImageResult } from "../types";

export { 
  IMAGE_AGENT_SYSTEM_INSTRUCTION, 
  assetService,
};

export class PipelineService {
  public async callApi(type: 'script' | 'image' | 'video', method: string, body: any, config?: Config): Promise<any> {
    if (type === 'image') return imageAgent.callApi(type, method, body, config);
    if (type === 'video') return videoAgent.callApi(type, method, body, config);
    
    return directorAgent.callApi(type, method, body, config);
  }

  public async generateCharacterVariants(script: string, characterName: string, visualStyle?: string, config?: Config, mainImageUrl?: string, mainPrompt?: string): Promise<any[]> {
    return imageAgent.generateCharacterVariants(script, characterName, visualStyle, config, mainImageUrl, mainPrompt);
  }

  public async analyzeScript(script: string, config?: Config): Promise<ScriptAnalysis> {
    return directorAgent.analyzeScript(script, config);
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, styleImageUrl?: string): Promise<Asset['subAssets']> {
    return assetService.generateSingleAssetPrompts(asset, visualStyle, config, styleImageUrl);
  }

  public async processScript(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    onProgress?: (msg: string) => void,
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number,
    existingAssets: Asset[] = [],
    globalRule?: string,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    return directorAgent.processScript(script, directorStyle, aspectRatio, visualStyle, config, onProgress, narrativeMode, targetSegments, existingAssets, globalRule, productionMode, isFlexibleDuration, spatialMode);
  }

  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = [], styleImageUrl?: string): Promise<Asset[]> {
    return assetService.preScanAssets(script, visualStyle, config, existingAssets, styleImageUrl);
  }

  public async analyzeStyleImage(imageUrl: string, config?: Config): Promise<string> {
    const prompt = `请分析这张图片的视觉风格、光影与氛围，并给出一段简洁的文字描述。
要求：
1. 分析核心风格、光影表现与氛围感。
2. 字数严格控制在 30 字以内。
3. 直接给出描述文字，不要有任何开场白或结尾。`;

    const result = await imageAgent.analyzeImage(imageUrl, prompt, config);
    return result.text || result.description || result;
  }

  public async regenerateSegmentPrompt(
    segment: Segment, 
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    allAssets: Asset[] = [], 
    globalRule?: string,
    lastSegmentContext: Segment | null = null,
    productionMode: 'director' | 'prompt' = 'director',
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<string> {
    return directorAgent.regenerateSegmentPrompt(segment, script, directorStyle, aspectRatio, visualStyle, config, allAssets, globalRule, lastSegmentContext, productionMode, spatialMode);
  }

  public fuzzyBindAssets(data: PipelineData): PipelineData {
    return directorAgent.fuzzyBindAssets(data);
  }

  public async callProcessScriptApi(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    existingAssets: Asset[] = [], 
    isSubsequentChunk: boolean = false, 
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number, 
    skipFuzzyBind: boolean = false, 
    lastSegmentContext: Segment | null = null, 
    globalRule?: string,
    onlySegments: boolean = false,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    return directorAgent.callProcessScriptApi(
      script, 
      directorStyle, 
      aspectRatio, 
      visualStyle, 
      config, 
      existingAssets, 
      isSubsequentChunk, 
      narrativeMode, 
      targetSegments, 
      skipFuzzyBind, 
      lastSegmentContext, 
      globalRule,
      onlySegments,
      productionMode,
      isFlexibleDuration,
      spatialMode
    );
  }

  public async generateSmartImage(imageConfig: SmartImageConfig, config?: Config): Promise<SmartImageResult> {
    return imageAgent.generateSmartImage(imageConfig, config);
  }

  public async generateSixView(asset: Asset, referenceImageUrl: string, config?: Config, variantId?: string): Promise<SmartImageResult> {
    return imageAgent.generateSixView(asset, referenceImageUrl, config, variantId);
  }

  public async generatePropSixView(asset: Asset, referenceImageUrl: string, config?: Config): Promise<SmartImageResult> {
    return imageAgent.generatePropSixView(asset, referenceImageUrl, config);
  }

  public async generateVideo(prompt: string, options: { 
    resolution?: string, 
    aspectRatio?: string, 
    duration?: string, 
    model?: string, 
    videoMode?: string,
    image?: { imageBytes: string, mimeType: string },
    lastFrame?: { imageBytes: string, mimeType: string },
    referenceImages?: { image: { imageBytes: string, mimeType: string }, referenceType: string }[],
    referenceAssets?: { data: string, mimeType: string, type: 'image' | 'video' | 'audio' }[]
  }, config?: Config): Promise<any> {
    return videoAgent.generateVideo(prompt, options, config);
  }

  public async getVideoOperationStatus(operationId: string, config?: Config, model?: string): Promise<any> {
    return videoAgent.getOperationStatus(operationId, config, model);
  }
}

export const pipelineService = new PipelineService();
