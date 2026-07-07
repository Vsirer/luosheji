const fs = require('fs');
let code = fs.readFileSync('components/WORKFLOW.tsx', 'utf8');

const targetStr = `                                const currentVal = getOptionValue(activeSkillObj.id, opt);`;
const replacementStr = `                                let currentVal = getOptionValue(activeSkillObj.id, opt);
                                if (typeof currentVal === "object" && currentVal !== null) {
                                  currentVal = currentVal.label || currentVal.name || currentVal.id || JSON.stringify(currentVal);
                                }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('components/WORKFLOW.tsx', code);
console.log("Done WORKFLOW");
