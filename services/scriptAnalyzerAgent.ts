import { BaseAgent } from "./baseAgent";
import { Config } from "../types";
import { ANALYZER_SYSTEM_PROMPT } from "../constants";

export class ScriptAnalyzerAgent extends BaseAgent {
  public async analyzeScript(script: string, config?: Config): Promise<string> {
    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: script }] }],
        config: {
          systemInstruction: ANALYZER_SYSTEM_PROMPT,
          temperature: 0.2
        }
      }, config);
      return response.text;
    } catch (e) {
      console.error("Script analysis failed:", e);
      throw e;
    }
  }
}

export const scriptAnalyzerAgent = new ScriptAnalyzerAgent();
