const fs = require('fs');
let code = fs.readFileSync('components/WORKFLOW.tsx', 'utf-8');

const targetStr = `    try {
      let finalItem = {
        ...item,
        canvasId: item.canvasId || activeCanvasId,
      };`;

const replacement = `    let attempts = 0;
    while (attempts < 3) {
      try {
        let finalItem = {
          ...item,
          canvasId: item.canvasId || activeCanvasId,
        };`;

code = code.replace(targetStr, replacement);

const endStr = `      return item;
    } catch (err) {
      console.error("Sync to cloud failed:", err);
      return item;
    }
  };`;

const endReplacement = `        break; // Exit loop if successful but no data.success
      } else {
        if (saveRes.status === 429) {
          console.warn(\`[DEBUG] Rate limited (429) on syncToCloud for task \${item.id}, retrying...\`);
          attempts++;
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          continue;
        }
        
        try {
          const errorData = await saveRes.json();
          console.error(
            \`[DEBUG] Failed to sync task \${item.id} to cloud:\`,
            saveRes.status,
            errorData,
          );
        } catch (e) {
          console.error(
            \`[DEBUG] Failed to sync task \${item.id} to cloud:\`,
            saveRes.status
          );
        }
        break; // Exit loop for other errors
      }
    } catch (err: any) {
      if (err.message && err.message.includes("429")) {
        console.warn(\`[DEBUG] Rate limited (429 Exception) on syncToCloud for task \${item.id}, retrying...\`);
        attempts++;
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        continue;
      }
      console.error("Sync to cloud failed:", err);
      break; // Exit loop
    }
  }
  return item;
};`;

code = code.replace(endStr, endReplacement);
fs.writeFileSync('components/WORKFLOW.tsx', code, 'utf-8');
