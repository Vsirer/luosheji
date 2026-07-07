const fs = require('fs');
let code = fs.readFileSync('components/WORKFLOW.tsx', 'utf-8');
let lines = code.split('\n');

const correctLines = [
'                "12": "12段分镜",',
'                "16": "16段分镜"',
'              };',
'              val = map[val] || val;',
'            }',
'          }',
'          userPrompt += `- **${opt.label || opt.id}**: ${val}\\n`;',
'        });',
'      }',
'',
'      if (sourceContents && sourceContents.length > 0) {',
'        userPrompt += `\\n本节点收到了 ${sourceContents.length} 个上游输入源，请结合以下输入源的信息执行本次自定义命令/提示词：\\n`;'
];

// Check we're replacing the right stuff
console.log('Replacing from:', lines[5693]);
console.log('To:', lines[5776]);

lines.splice(5693, 84, ...correctLines);

fs.writeFileSync('components/WORKFLOW.tsx', lines.join('\n'), 'utf-8');
