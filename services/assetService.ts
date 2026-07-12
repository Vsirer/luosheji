import { assetAgent } from "../components/agents/assetAgent.ts";
import { Asset, Config, PipelineData, Segment } from "../types.ts";

export class AssetService {
  /**
   * 预扫描剧本中的资产
   */
  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = [], styleImageUrl?: string): Promise<Asset[]> {
    return assetAgent.preScanAssets(script, visualStyle, config, existingAssets, styleImageUrl);
  }

  /**
   * 为分镜绑定资产（模糊匹配与逻辑惯性）
   */
  public fuzzyBindAssets(data: any): PipelineData {
    return assetAgent.fuzzyBindAssets(data);
  }

  /**
   * 生成单个资产的标准化提示词
   */
  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, styleImageUrl?: string): Promise<Asset['subAssets']> {
    return assetAgent.generateSingleAssetPrompts(asset, visualStyle, config, styleImageUrl);
  }

  /**
   * 获取资产的显示 ID (如 图1, 场景2)
   */
  public getAssetDisplayId(id: string, type: string, assetsList: Asset[]): string {
    return assetAgent.getAssetDisplayId(id, type, assetsList);
  }

  /**
   * 清理并合并资产列表
   */
  public cleanupAssets(assets: Asset[]): Asset[] {
    return assetAgent.cleanupAssets(assets);
  }

  /**
   * 清理 Prompt 文本中的 ID 标签
   */
  public cleanPromptText(text: string): string {
    return assetAgent.cleanPromptText(text);
  }
}

export const assetService = new AssetService();
