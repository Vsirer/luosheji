import { BaseAgent } from "./baseAgent";
import { Config } from "../types";
import { REWRITE_SYSTEM_PROMPT } from "../constants";

export class ScriptRewriterAgent extends BaseAgent {
  public async rewriteScript(script: string, config?: Config): Promise<string> {
    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: script }] }],
        config: {
          systemInstruction: REWRITE_SYSTEM_PROMPT,
          temperature: 0.8
        }
      }, config);
      return response.text;
    } catch (e) {
      console.error("Script rewrite failed:", e);
      throw e;
    }
  }
}

export const scriptRewriterAgent = new ScriptRewriterAgent();
