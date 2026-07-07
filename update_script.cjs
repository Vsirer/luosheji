const fs = require('fs');
let code = fs.readFileSync('components/InlineScriptConsole.tsx', 'utf8');

const targetStart = '{/* Creation Type */}';
const targetEnd = '{/* Points indicator */}';

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.log("Not found");
  process.exit(1);
}

const before = code.substring(0, startIndex);
const after = code.substring(endIndex);
const inside = code.substring(startIndex, endIndex);

const newInside = `
          {(() => {
            const activeId = scriptConfig.activeSubTab === "director" ? directorConfig?.generationMode : scriptConfig.activeSubTab;
            const currentWs = availableTextSkills.find((s: any) => s.id === activeId);
            
            if (!currentWs) return null;

            if (currentWs.id === "create" || currentWs.id === "createScript" || currentWs.id === "create-script") {
              return (
                <>
${inside.split('\n').map(line => '                  ' + line).join('\n')}
                </>
              );
            }

            if (currentWs.customOptions && currentWs.customOptions.length > 0) {
              return currentWs.customOptions.map((opt: any) => {
                const currentVal = scriptConfig[opt.id] || opt.choices?.[0] || "";
                const isOpen = activeDropdownId === \`\${currentWs.id}_\${opt.id}\`;
                
                return (
                  <div key={opt.id} className="relative">
                    <button
                      onClick={() => {
                        setShowCreationTypeMenu(false);
                        setShowGenreStyleMenu(false);
                        setShowLengthMenu(false);
                        setActiveDropdownId(isOpen ? null : \`\${currentWs.id}_\${opt.id}\`);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold flex items-center space-x-1 rounded-xl transition-all text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800 whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="shrink-0">{opt.name}: {currentVal}</span>
                      <ChevronDown
                        className={\`w-3 h-3 text-gray-400 transition-transform \${isOpen ? "rotate-180" : ""}\`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <div className="absolute bottom-full left-0 mb-2 z-[150]">
                          <div
                            className="fixed inset-0"
                            onClick={() => setActiveDropdownId(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            className="relative w-32 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-2 flex flex-col gap-1 overflow-hidden"
                          >
                            {(opt.choices || []).map((c: string) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setScriptConfig((prev: any) => ({
                                    ...prev,
                                    [opt.id]: c
                                  }));
                                  setActiveDropdownId(null);
                                }}
                                className={\`w-full p-2 rounded-lg text-left text-[11px] transition-colors \${
                                  currentVal === c
                                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold"
                                    : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                                }\`}
                              >
                                {c}
                              </button>
                            ))}
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              });
            }

            return null;
          })()}
          `;

fs.writeFileSync('components/InlineScriptConsole.tsx', before + newInside + after);
console.log("Done");
