const fs = require('fs');
let code = fs.readFileSync('components/InlineScriptConsole.tsx', 'utf8');

const targetStr = `                const currentVal = scriptConfig[opt.id] || opt.choices?.[0] || "";`;
const replacementStr = `                let currentVal = scriptConfig[opt.id] || opt.choices?.[0] || "";
                if (typeof currentVal === "object" && currentVal !== null) {
                  currentVal = currentVal.label || currentVal.name || currentVal.id || JSON.stringify(currentVal);
                }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('components/InlineScriptConsole.tsx', code);
console.log("Done");
