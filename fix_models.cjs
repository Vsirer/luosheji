const fs = require('fs');
let code = fs.readFileSync('components/WORKFLOW.tsx', 'utf-8');

// Replace image dropdown logic
code = code.replace(
  `                    const imageBaseModelValue = config?.image?.model || "gemini-3.1-flash-image-preview";
                    const imageBaseModelLabel = config?.image?.displayName || (config?.image?.model && config.image.model !== "gemini-3.1-flash-image-preview" ? config.image.model : "nano banana 2");
                    const allAvailableModels = [
                      { label: imageBaseModelLabel, value: imageBaseModelValue },
                      ...IMAGE_MODELS.filter(m => m.value !== "gemini-3.1-flash-image-preview" && m.value !== imageBaseModelValue),`,
  `                    const imageBaseModelValue = config?.image?.model || "gemini-3.1-flash-image-preview";
                    const imageBaseModelLabel = config?.image?.displayName || (config?.image?.model && config.image.model !== "gemini-3.1-flash-image-preview" ? config.image.model : "nano banana 2");
                    
                    const gptImageModelValue = config?.gptImage?.model || "gpt-image-2";
                    const gptImageModelLabel = config?.gptImage?.displayName || (config?.gptImage?.model && config.gptImage.model !== "gpt-image-2" ? config.gptImage.model : "GPT-Image-2");

                    const allAvailableModels = [
                      { label: imageBaseModelLabel, value: imageBaseModelValue },
                      { label: gptImageModelLabel, value: gptImageModelValue },
                      ...IMAGE_MODELS.filter(m => m.value !== "gemini-3.1-flash-image-preview" && m.value !== imageBaseModelValue && m.value !== "gpt-image-2" && m.value !== gptImageModelValue),`
);

// Replace video dropdown logic
code = code.replace(
  `                          const videoBaseModelValue = config?.video?.model || "seedance2.0";
                          const videoBaseModelLabel = config?.video?.displayName || (config?.video?.model && config.video.model !== "seedance2.0" ? config.video.model : "RH-SD2.0");

                          const allVideoModels = [
                            { label: videoBaseModelLabel, value: videoBaseModelValue },
                            ...VIDEO_MODELS.filter(m => m.value !== "seedance2.0" && m.value !== videoBaseModelValue),`,
  `                          const videoBaseModelValue = config?.videoSeedance?.model || config?.video?.model || "seedance2.0";
                          const videoBaseModelLabel = config?.videoSeedance?.displayName || config?.video?.displayName || (config?.videoSeedance?.model && config.videoSeedance.model !== "seedance2.0" ? config.videoSeedance.model : "RH-SD2.0");
                          
                          const videoMiniModelValue = config?.videoSeedanceMini?.model || "seedance-mini";
                          const videoMiniModelLabel = config?.videoSeedanceMini?.displayName || (config?.videoSeedanceMini?.model && config.videoSeedanceMini.model !== "seedance-mini" ? config.videoSeedanceMini.model : "RH-SD2.0mini");

                          const allVideoModels = [
                            { label: videoBaseModelLabel, value: videoBaseModelValue },
                            { label: videoMiniModelLabel, value: videoMiniModelValue },
                            ...VIDEO_MODELS.filter(m => m.value !== "seedance2.0" && m.value !== videoBaseModelValue && m.value !== "seedance-mini" && m.value !== videoMiniModelValue),`
);

fs.writeFileSync('components/WORKFLOW.tsx', code, 'utf-8');
console.log('Replaced custom model selection');
