const fs = require('fs');
let code = fs.readFileSync('components/WORKFLOW.tsx', 'utf-8');
let lines = code.split('\n');

const newSync = `  const syncToCloud = async (item: HistoryItem) => {
    const token = localStorage.getItem("token");
    if (!token) return item;

    // Avoid redundant network sync requests if nothing has changed compared to state
    try {
      const existing = history.find((h) => h.id === item.id);
      if (existing) {
        const posChanged = JSON.stringify(existing.position) !== JSON.stringify(item.position);
        const statusChanged = existing.status !== item.status;
        const imgChanged = existing.imageUrl !== item.imageUrl;
        const vidChanged = existing.videoUrl !== item.videoUrl;
        const configChanged = JSON.stringify(existing.config) !== JSON.stringify(item.config);
        const hiddenChanged = existing.hiddenFromCanvas !== item.hiddenFromCanvas;
        const errorChanged = existing.error !== item.error;

        if (
          !posChanged &&
          !statusChanged &&
          !imgChanged &&
          !vidChanged &&
          !configChanged &&
          !hiddenChanged &&
          !errorChanged
        ) {
          return item;
        }
      }
    } catch (e) {
      console.warn("[syncToCloud] Error checking differences:", e);
    }

    let attempts = 0;
    while (attempts < 3) {
      try {
        let finalItem = {
          ...item,
          canvasId: item.canvasId || activeCanvasId,
        };

        // 1. If it's a blob URL, convert to base64 so the backend can upload to OSS
        const mediaUrl = item.type === "video" ? item.videoUrl : item.imageUrl;
        if (mediaUrl && mediaUrl.startsWith("blob:")) {
          const res = await fetch(mediaUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const base64Data = await base64Promise;

          if (item.type === "video") {
            finalItem.videoUrl = base64Data;
          } else {
            finalItem.imageUrl = base64Data;
          }
        }

        // 2. Save to MySQL (Backend will handle OSS upload if configured)
        console.log(
          \`[DEBUG] Syncing task \${item.id} to cloud (status: \${item.status}, attempt: \${attempts + 1})...\`,
        );
        const saveRes = await fetch("/api/user/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: \`Bearer \${token}\`,
          },
          body: JSON.stringify(finalItem),
        });

        if (saveRes.ok) {
          const data = await safeJson(saveRes);
          if (data && data.success) {
            console.log(
              \`[DEBUG] Task \${item.id} synced successfully. OSS URL: \${data.ossUrl || "N/A"}\`,
            );
            // Return item with updated OSS URLs if available
            return {
              ...item,
              imageUrl: data.imageUrl || item.imageUrl,
              videoUrl: data.videoUrl || item.videoUrl,
              ossUrl: data.ossUrl || item.ossUrl,
              arkOriginalUrl: data.arkOriginalUrl || item.arkOriginalUrl,
              config: data.config || item.config,
            };
          }
          break; // Exit loop if successful but no data.success
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

// replace from lines[5853] (line 5854) to lines[5986] (line 5987)
lines.splice(5853, 5987 - 5853 + 1, ...newSync.split('\n'));
fs.writeFileSync('components/WORKFLOW.tsx', lines.join('\n'), 'utf-8');
