import { dnaAgent } from "./dnaAgent";
import { Asset, Config } from "../types";

export class DnaService {
  public async analyzeImageForDNA(imageUrl: string, assetType: string, config?: Config): Promise<any> {
    return dnaAgent.analyzeImageForDNA(imageUrl, assetType, config);
  }

  public async generateDetailedDNA(asset: Asset, script: string, config?: Config): Promise<string> {
    return dnaAgent.generateDetailedDNA(asset, script, config);
  }
}

export const dnaService = new DnaService();
