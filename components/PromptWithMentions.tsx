import React, { useRef, useEffect } from "react";
import { User, Camera, Box, Film, Image as ImageIcon, AtSign, Music } from "lucide-react";
import { getThumbnailUrl } from "../services/utils";

interface PromptWithMentionsProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  assets?: any[];
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onScroll?: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onDoubleClick?: () => void;
  id?: string;
  paddingClasses?: string;
  fontSizeClass?: string;
  lineHeightClass?: string;
}

interface Segment {
  type: "text" | "mention";
  text: string;
  asset?: any;
}

// Parse prompt text into plain text chunks and tagged mentions using exact match mapping to assets
export function parsePrompt(text: string, assets: any[] = []): Segment[] {
  if (!text) return [];

  const knownLabels = assets
    .map((a) => a.label)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const escapeRegExp = (str: string) =>
    str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

  let regexParts: string[] = [];
  if (knownLabels.length > 0) {
    const escapedLabels = knownLabels.map(escapeRegExp);
    regexParts.push(`@(${escapedLabels.join("|")})`);
  }
  
  // Create a regex for standard characters-based mentions so typed text is recognized
  regexParts.push(`@([A-Za-z0-9_\\u4e00-\\u9fa5\\-·]+)`);

  const regex = new RegExp(regexParts.join("|"), "g");

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
      });
    }

    const matchedText = match[0];
    const mentionText = matchedText.slice(1);

    const foundAsset = assets.find((a) => a.label === mentionText);

    segments.push({
      type: "mention",
      text: matchedText,
      asset: foundAsset,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return segments;
}

// Convert HTML to simple plain text safely
export function htmlToText(node: Node): string {
  let text = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.classList.contains("mention")) {
        const lastChild = el.lastElementChild;
        let mentionText = el.getAttribute("data-mention") || (lastChild ? lastChild.textContent : null) || el.innerText || "";
        if (mentionText.startsWith("@ @")) {
          mentionText = "@" + mentionText.slice(3);
        }
        text += mentionText;
      } else if (el.tagName === "BR") {
        text += "\n";
      } else if (el.tagName === "DIV" || el.tagName === "P") {
        const inner = htmlToText(el);
        text += (text ? "\n" : "") + inner;
      } else {
        text += htmlToText(el);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      text += child.nodeValue || "";
    }
  });
  return text;
}

// Convert text into colored HTML with inline thumbnail elements
export function textToHtml(text: string, assets: any[] = []): string {
  if (!text) return "";

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const segments = parsePrompt(text, assets);

  return segments
    .map((seg) => {
      if (seg.type === "mention") {
        const asset = seg.asset;
        let category = "default";

        if (asset) {
          const type = (asset.type || "").toLowerCase();
          const label = (asset.label || "").toLowerCase();

          if (type === "character" || type === "character_asset" || label.includes("角色")) {
            category = "text";
          } else if (type === "audio" || label.includes("音频") || type === "sound") {
            category = "audio";
          } else if (type === "video" || label.includes("视频")) {
            category = "video";
          } else if (type === "scene" || label.includes("场景") || type === "prop" || label.includes("道具") || type === "image" || label.includes("图")) {
            category = "image";
          }
        }

        // Beautiful professional background presets
        let bgClass = "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]";
        if (category === "text") {
          bgClass = "bg-[#f7fee7] text-[#4d7c0f] border-[#d9f99d]";
        } else if (category === "audio") {
          bgClass = "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]";
        } else if (category === "video") {
          bgClass = "bg-[#faf5ff] text-[#7e22ce] border-[#e9d5ff]";
        } else if (category === "image") {
          bgClass = "bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]";
        }

        const thumbUrl = asset ? (asset.imageUrl || asset.videoUrl || asset.ossUrl) : null;
        const resolvedThumb = thumbUrl ? getThumbnailUrl(thumbUrl) : null;

        let mediaHtml = "";
        if (resolvedThumb) {
          const isVideo =
            asset && (
              asset.type === "video" ||
              (asset.videoUrl && !asset.imageUrl) ||
              (typeof resolvedThumb === "string" && (
                resolvedThumb.toLowerCase().endsWith(".mp4") ||
                resolvedThumb.toLowerCase().endsWith(".mov") ||
                resolvedThumb.toLowerCase().endsWith(".webm") ||
                resolvedThumb.includes("video")
              ))
            );

          if (isVideo) {
            mediaHtml = `<span class="w-4 h-4 rounded overflow-hidden flex items-center justify-center bg-black/10 inline-block align-middle mr-1 border border-black/5 flex-shrink-0"><video src="${resolvedThumb}" class="w-full h-full object-cover" muted playsinline preload="metadata"></video></span>`;
          } else {
            mediaHtml = `<span class="w-4 h-4 rounded overflow-hidden flex items-center justify-center bg-black/10 inline-block align-middle mr-1 border border-black/5 flex-shrink-0"><img src="${resolvedThumb}" class="w-full h-full object-cover" referrerpolicy="no-referrer" /></span>`;
          }
        } else {
          // Default icon matching category if no thumbnail exists
          let iconSvg = "@";
          if (category === "text") iconSvg = `<span class="text-[10px] text-green-700 font-bold">👤</span>`;
          else if (category === "audio") iconSvg = `<span class="text-[10px] text-purple-700 font-bold">🎵</span>`;
          else if (category === "video") iconSvg = `<span class="text-[10px] text-indigo-700 font-bold">🎬</span>`;
          else if (category === "image") iconSvg = `<span class="text-[10px] text-[#0e7490] font-bold">📷</span>`;

          mediaHtml = `<span class="w-4 h-4 rounded overflow-hidden flex items-center justify-center bg-black/5 inline-flex align-middle mr-1 border border-black/5 flex-shrink-0">${iconSvg}</span>`;
        }

        return `<span class="mention inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-semibold mx-0.5 align-middle select-all pointer-events-auto transition-colors ${bgClass}" contenteditable="false" data-mention="${escapeHtml(seg.text)}">${mediaHtml}<span class="leading-none text-current font-bold">${escapeHtml(seg.text)}</span></span>`;
      } else {
        return escapeHtml(seg.text).replace(/\n/g, "<br>");
      }
    })
    .join("");
}

// Expose selection helpers
export function getCaretCharacterOffsetWithin(element: HTMLElement): number {
  let caretOffset = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = getHtmlTextLength(preCaretRange.cloneContents());
  }
  return caretOffset;
}

function getHtmlTextLength(node: Node): number {
  let len = 0;
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.classList.contains("mention")) {
        const mentionText = el.getAttribute("data-mention") || el.innerText || "";
        len += mentionText.length;
      } else if (el.tagName === "BR") {
        len += 1;
      } else if (el.tagName === "DIV" || el.tagName === "P") {
        len += 1 + getHtmlTextLength(el);
      } else {
        len += getHtmlTextLength(el);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      len += (child.nodeValue || "").length;
    }
  });
  return len;
}

export function setCaretPosition(element: HTMLElement, offset: number) {
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (!sel) return;

  const range = doc.createRange();
  range.setStart(element, 0);
  range.collapse(true);

  let currentOffset = 0;
  let found = false;

  function traverseNodes(node: Node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = (node.nodeValue || "").length;
      if (currentOffset + textLen >= offset) {
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        found = true;
      } else {
        currentOffset += textLen;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains("mention")) {
        const mentionText = el.getAttribute("data-mention") || el.innerText || "";
        const textLen = mentionText.length;
        if (currentOffset + textLen >= offset) {
          const half = textLen / 2;
          if (offset - currentOffset < half) {
            range.setStartBefore(el);
          } else {
            range.setStartAfter(el);
          }
          range.collapse(true);
          found = true;
        } else {
          currentOffset += textLen;
        }
      } else if (el.tagName === "BR") {
        if (currentOffset + 1 >= offset) {
          range.setStartAfter(el);
          range.collapse(true);
          found = true;
        } else {
          currentOffset += 1;
        }
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          traverseNodes(el.childNodes[i]);
          if (found) break;
        }
      }
    }
  }

  traverseNodes(element);

  if (!found) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

export const PromptWithMentions: React.FC<PromptWithMentionsProps> = ({
  value,
  onChange,
  placeholder = "",
  assets = [],
  className = "",
  disabled = false,
  onKeyDown,
  textareaRef,
  onDoubleClick,
  id,
  paddingClasses = "pt-3 pb-3 pr-3 pl-10",
  fontSizeClass = "text-sm",
  lineHeightClass = "leading-6",
}) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Sync internal div content with incoming value prop (only if different to prevent typing glitches)
  useEffect(() => {
    if (isComposingRef.current) return;
    const el = editableRef.current;
    if (el) {
      const currentText = htmlToText(el);
      if (currentText !== value) {
        const isFocused = document.activeElement === el;
        const currentOffset = isFocused ? getCaretCharacterOffsetWithin(el) : null;

        el.innerHTML = textToHtml(value, assets);

        if (isFocused && currentOffset !== null) {
          try {
            setCaretPosition(el, currentOffset);
          } catch (e) {
            // Safe fallback to end
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }
    }
  }, [value, assets]);

  // Expose methods on textareaRef to mock underlying textarea element
  useEffect(() => {
    if (textareaRef) {
      const el = editableRef.current;
      if (el) {
        const mockObj = {
          focus: () => {
            el.focus();
          },
          setSelectionRange: (start: number, end: number) => {
            setCaretPosition(el, start);
          },
          get selectionStart() {
            return getCaretCharacterOffsetWithin(el);
          },
          get selectionEnd() {
            return getCaretCharacterOffsetWithin(el);
          },
          get value() {
            return htmlToText(el);
          },
          classList: el.classList,
          style: el.style,
          id: el.id,
        };

        (textareaRef as any).current = mockObj;
      }
    }
    return () => {
      if (textareaRef) {
        (textareaRef as any).current = null;
      }
    };
  }, [textareaRef, value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = htmlToText(e.currentTarget);
    const cursorPos = getCaretCharacterOffsetWithin(e.currentTarget);
    const currentTarget = e.currentTarget;
    
    const mockEvent = {
      target: {
        value: text,
        selectionStart: cursorPos,
        selectionEnd: cursorPos,
        getBoundingClientRect: () => currentTarget.getBoundingClientRect(),
      },
      currentTarget: currentTarget,
    } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
    
    onChange(mockEvent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) {
      onKeyDown(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col">
      {/* Absolute Placeholder layer */}
      {(!value || value.trim() === "") && (
        <div className={`absolute pointer-events-none select-none text-gray-400/70 z-0 ${paddingClasses} ${fontSizeClass} ${lineHeightClass} font-sans`}>
          {placeholder}
        </div>
      )}

      {/* contenteditable rich editor */}
      <div
        id={id}
        ref={editableRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onDoubleClick={onDoubleClick}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          handleInput(e);
        }}
        className={`${className} ${paddingClasses} outline-none focus:outline-none overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all relative z-10 w-full flex-1 min-h-0 text-gray-800 dark:text-gray-100`}
        style={{
          // Custom caret color inside contenteditable
          caretColor: "#6366f1",
        }}
      />
    </div>
  );
};
