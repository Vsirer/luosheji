import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Layers, 
  Sheet, 
  TableProperties, 
  BookOpen, 
  FileSpreadsheet, 
  FileAudio,
  Eye,
  Loader2,
  Clock,
  Menu,
  MessageSquare,
  Sparkles,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
const safePdfjsLib = (pdfjsLib as any).GlobalWorkerOptions ? (pdfjsLib as any) : ((pdfjsLib as any).default || pdfjsLib);
if (typeof window !== 'undefined' && safePdfjsLib && safePdfjsLib.GlobalWorkerOptions) {
  safePdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${safePdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

// Interfaces
interface OfficePreviewerProps {
  url: string;
  filename?: string;
  onTextExtracted?: (text: string) => void;
}

interface SpreadsheetSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

interface SlideData {
  title: string;
  bullets: string[];
  content: string[];
  speakerNotes?: string;
}

export const OfficePreviewer: React.FC<OfficePreviewerProps> = ({ url, filename = 'document', onTextExtracted }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'powerpoint' | 'word' | 'pdf' | 'text'>('text');
  
  // Zoom & Maximize states
  const [zoomLevel, setZoomLevel] = useState(1); // Default is 100% (index 1)
  const [isMaximized, setIsMaximized] = useState(false);
  const zoomFactors = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];

  // Scale helper functions for various file formats
  const getExcelHeaderCellClass = (level: number) => {
    switch (level) {
      case 0: return 'p-1 text-[8px]';
      case 2: return 'p-2 text-[11px]';
      case 3: return 'p-2.5 text-xs';
      case 4: return 'p-3 text-sm';
      case 5: return 'p-3.5 text-base';
      case 1:
      default: return 'p-1.5 text-[10px]';
    }
  };

  const getExcelDataCellClass = (level: number) => {
    switch (level) {
      case 0: return 'p-1 text-[9px]';
      case 2: return 'p-2.5 text-xs sm:text-sm';
      case 3: return 'p-3 text-sm sm:text-base';
      case 4: return 'p-3.5 text-base sm:text-lg';
      case 5: return 'p-4 text-lg sm:text-xl';
      case 1:
      default: return 'p-2 text-[10px] sm:text-xs';
    }
  };

  const getPptTitleClass = (level: number) => {
    switch (level) {
      case 0: return 'text-xs';
      case 2: return 'text-base sm:text-lg';
      case 3: return 'text-lg sm:text-xl';
      case 4: return 'text-xl sm:text-2xl';
      case 5: return 'text-2xl sm:text-3xl';
      case 1:
      default: return 'text-sm sm:text-base';
    }
  };

  const getPptBodyClass = (level: number) => {
    switch (level) {
      case 0: return 'text-[10px] space-y-1';
      case 2: return 'text-sm space-y-2.5';
      case 3: return 'text-base space-y-3';
      case 4: return 'text-lg space-y-3.5';
      case 5: return 'text-xl space-y-4';
      case 1:
      default: return 'text-xs space-y-2';
    }
  };

  const getPdfBodyClass = (level: number) => {
    switch (level) {
      case 0: return 'text-[10px]';
      case 2: return 'text-sm';
      case 3: return 'text-base';
      case 4: return 'text-lg';
      case 5: return 'text-xl';
      case 1:
      default: return 'text-xs';
    }
  };

  const getWordBodyClass = (level: number) => {
    switch (level) {
      case 0: return 'prose-xs text-xs';
      case 2: return 'prose-base text-sm sm:text-base';
      case 3: return 'prose-lg text-base sm:text-lg';
      case 4: return 'prose-xl text-lg sm:text-xl';
      case 5: return 'prose-2xl text-xl sm:text-2xl';
      case 1:
      default: return 'prose-sm text-xs sm:text-sm';
    }
  };

  // Keyboard Escape and body scroll lock side-effects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMaximized]);

  // Excel states
  const [excelSheets, setExcelSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [excelSearch, setExcelSearch] = useState('');
  
  // PPT states
  const [pptSlides, setPptSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Word / Text states
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState<string>('');
  const [tableOfContents, setTableOfContents] = useState<string[]>([]);
  
  // PDF states
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPdfPage, setCurrentPdfPage] = useState(0);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    const lowerUrl = url.toLowerCase();

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP 错误 ${res.status}`);
        const buffer = await res.arrayBuffer();

        if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.csv')) {
          setFileType('excel');
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheets: SpreadsheetSheet[] = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            // Filter empty rows
            const rows = jsonData.filter(row => row && row.length > 0);
            const maxCols = Math.max(...rows.map(r => r.length), 0);
            
            // Build standard A, B, C column headers
            const headers = Array.from({ length: maxCols }, (_, i) => {
              let temp = i;
              let colName = '';
              while (temp >= 0) {
                colName = String.fromCharCode((temp % 26) + 65) + colName;
                temp = Math.floor(temp / 26) - 1;
              }
              return colName;
            });

            // Format all cell values to string
            const formattedRows = rows.map((row) => 
              Array.from({ length: maxCols }, (_, i) => 
                row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''
              )
            );

            return {
              name: sheetName,
              headers,
              rows: formattedRows
            };
          });

          setExcelSheets(sheets);
          if (onTextExtracted) {
            const fullText = sheets.map(s => `【工作表: ${s.name}】\n` + s.rows.map(r => r.join(', ')).join('\n')).join('\n\n');
            onTextExtracted(fullText);
          }
          setLoading(false);

        } else if (lowerUrl.endsWith('.pptx') || lowerUrl.endsWith('.ppt')) {
          setFileType('powerpoint');
          
          try {
            // Dynamic import of jszip to extract slide text
            const JSZipModule = await import('jszip');
            const JSZip = JSZipModule.default || (JSZipModule as any);
            const zip = await JSZip.loadAsync(buffer);
            
            // Find all ppt/slides/slide*.xml
            const slideFiles = Object.keys(zip.files).filter(name => 
              name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
            );
            
            if (slideFiles.length > 0) {
              // Sort files by slide index
              slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?. [0] || '0');
                const numB = parseInt(b.match(/\d+/)?. [0] || '0');
                return numA - numB;
              });

              const extractedSlides: SlideData[] = [];
              
              for (let i = 0; i < slideFiles.length; i++) {
                const xmlText = await zip.files[slideFiles[i]].async("text");
                
                // Fast regex based text extractor
                const textNodes: string[] = [];
                const regex = /<a:t>([^<]+)<\/a:t>/g;
                let match;
                while ((match = regex.exec(xmlText)) !== null) {
                  if (match[1] && match[1].trim()) {
                    textNodes.push(match[1].trim());
                  }
                }

                // Look for notes slide
                let speakerNotes = '';
                const slideNum = slideFiles[i].match(/\d+/)?. [0] || '';
                const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`;
                if (zip.files[notesFile]) {
                  const notesXmlText = await zip.files[notesFile].async("text");
                  const notesTextNodes: string[] = [];
                  let notesMatch;
                  while ((notesMatch = regex.exec(notesXmlText)) !== null) {
                    if (notesMatch[1] && notesMatch[1].trim()) {
                      notesTextNodes.push(notesMatch[1].trim());
                    }
                  }
                  speakerNotes = notesTextNodes.join('\n');
                }

                // Structure the extracted slide text
                const title = textNodes[0] || `幻灯片 ${i + 1}`;
                const bullets = textNodes.slice(1).filter(t => t.length > 1);
                
                extractedSlides.push({
                  title,
                  bullets: bullets.slice(0, 8),
                  content: textNodes.slice(1),
                  speakerNotes: speakerNotes || undefined
                });
              }

              setPptSlides(extractedSlides);
              if (onTextExtracted) {
                onTextExtracted(extractedSlides.map((s, idx) => `[幻灯片 ${idx + 1}] ${s.title}\n` + s.bullets.join('\n')).join('\n\n'));
              }
            } else {
              // Fallback to text outline
              setFileType('text');
              const decoder = new TextDecoder('utf-8');
              setTextContent(decoder.decode(buffer));
            }
          } catch (pptxErr) {
            console.error("Failed to extract PowerPoint ZIP contents", pptxErr);
            // Fallback
            setFileType('text');
            const decoder = new TextDecoder('utf-8');
            setTextContent(decoder.decode(buffer));
          }
          setLoading(false);

        } else if (lowerUrl.endsWith('.docx')) {
          setFileType('word');
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          const text = result.value || '';
          setTextContent(text);
          
          // Generate simple Table of Contents from text lines that look like headings
          const lines = text.split('\n');
          const headings = lines
            .map(l => l.trim())
            .filter(l => l.length > 3 && l.length < 50 && (l.startsWith('第') || l.startsWith('一') || l.startsWith('二') || l.startsWith('三') || l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.') || /^[一二三四五六七八九十]+、/.test(l)));
          setTableOfContents(headings.slice(0, 15));
          
          if (onTextExtracted) onTextExtracted(text);
          setLoading(false);

        } else if (lowerUrl.endsWith('.pdf')) {
          setFileType('pdf');
          const loadingTask = safePdfjsLib.getDocument({ data: buffer });
          const pdf = await loadingTask.promise;
          const pages: string[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContentObj = await page.getTextContent();
            const pageText = textContentObj.items.map((item: any) => item.str).join(' ');
            pages.push(pageText);
          }

          setPdfPages(pages);
          if (onTextExtracted) onTextExtracted(pages.join('\n\n'));
          setLoading(false);

        } else {
          // Standard text file or unknown format fallback
          setFileType('text');
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(buffer);
          setTextContent(text);
          
          // Simple headings detection for text
          const lines = text.split('\n');
          const headings = lines
            .map(l => l.trim())
            .filter(l => l.startsWith('#') || (l.startsWith('【') && l.endsWith('】')));
          setTableOfContents(headings.slice(0, 12));
          
          if (onTextExtracted) onTextExtracted(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("OfficePreviewer loading failed", err);
        setError(`加载文件失败: ${err.message || err}`);
        setLoading(false);
      });
  }, [url]);

  // PowerPoint Presentation slide interval loop
  useEffect(() => {
    let interval: any;
    if (isPlaying && fileType === 'powerpoint' && pptSlides.length > 0) {
      interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % pptSlides.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, fileType, pptSlides]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950/25 rounded-2xl border border-zinc-800 h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm text-zinc-300 font-bold">正在安全加载 & 解析多维 Office 智能文档...</p>
        <p className="text-xs text-zinc-500 mt-1.5 font-mono">100% 客户端离线解密编译中</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-red-950/20 rounded-2xl border border-red-900/40 h-80">
        <span className="text-3xl mb-3">⚠️</span>
        <p className="text-sm font-black text-red-300">{error}</p>
        <p className="text-xs text-zinc-500 mt-2 max-w-md">此文件可能已损坏，或是服务器安全拦截策略，请稍候重试或通过对话框重新上传。</p>
      </div>
    );
  }

  // Render Excel Spreadsheets
  if (fileType === 'excel') {
    const activeSheet = excelSheets[activeSheetIndex];
    if (!activeSheet) {
      return (
        <div className="p-8 text-center text-zinc-500">
          表格解析为空
        </div>
      );
    }

    // Filter rows based on search
    const filteredRows = activeSheet.rows.filter(row => 
      excelSearch === '' || 
      row.some(cell => cell.toLowerCase().includes(excelSearch.toLowerCase()))
    );

    return (
      <div className={isMaximized 
        ? "fixed inset-0 z-[100] bg-zinc-950 flex flex-col p-4 md:p-6 animate-in fade-in duration-200"
        : "flex flex-col h-[520px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl transition-all"
      }>
        {/* Spreadsheet Header Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-xs font-black text-zinc-100">{filename}</span>
              <p className="text-[9px] font-mono text-zinc-500">EXCEL SPREADSHEET VIEW • {activeSheet.rows.length} ROWS</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Table Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索表格数据..."
                value={excelSearch}
                onChange={(e) => setExcelSearch(e.target.value)}
                className="w-24 sm:w-40 pl-8 pr-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800 focus:border-emerald-500 text-[10px] sm:text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-all"
              />
              <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-2.5" />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-1 py-0.5 space-x-0.5 shrink-0">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0, prev - 1))}
                disabled={zoomLevel === 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-zinc-500 min-w-[28px] text-center">
                {Math.round(zoomFactors[zoomLevel] * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(zoomFactors.length - 1, prev + 1))}
                disabled={zoomLevel === zoomFactors.length - 1}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Maximize Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title={isMaximized ? "退出全屏 (Esc)" : "全屏放大"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Downloader */}
            <a
              href={url}
              download={filename}
              className="p-2 bg-zinc-950 hover:bg-emerald-950 hover:text-emerald-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title="下载原始表格"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Spreadsheet Main Grid Area */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-zinc-950">
          <table className="w-full text-left border-collapse border-spacing-0 table-fixed min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-zinc-900 shadow-[0_1px_0_0_rgba(63,63,70,1)]">
              <tr>
                {/* Diagonal Blank Header cell */}
                <th 
                  className={`${getExcelHeaderCellClass(zoomLevel)} text-center font-bold text-zinc-500 border-r border-b border-zinc-800 bg-zinc-900 select-none`}
                  style={{ width: `${Math.round(48 * zoomFactors[zoomLevel])}px` }}
                >
                  /
                </th>
                {activeSheet.headers.map((h, idx) => (
                  <th 
                    key={idx} 
                    className={`${getExcelHeaderCellClass(zoomLevel)} font-black text-zinc-400 border-r border-b border-zinc-800 bg-zinc-900 select-none text-center`}
                    style={{ width: `${Math.round(150 * zoomFactors[zoomLevel])}px` }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={activeSheet.headers.length + 1} className="py-20 text-center text-zinc-600 text-xs font-medium">
                    无匹配数据行
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-900/40 border-b border-zinc-800/40">
                    {/* Row Index label */}
                    <td 
                      className={`${getExcelHeaderCellClass(zoomLevel)} text-center font-mono text-zinc-500 bg-zinc-900 border-r border-zinc-800 sticky left-0 z-0 select-none`}
                      style={{ width: `${Math.round(48 * zoomFactors[zoomLevel])}px` }}
                    >
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td 
                        key={cIdx} 
                        className={`${getExcelDataCellClass(zoomLevel)} text-zinc-300 border-r border-zinc-800/30 truncate`}
                        style={{ maxWidth: `${Math.round(150 * zoomFactors[zoomLevel])}px` }}
                        title={cell}
                      >
                        {cell || <span className="text-zinc-800 font-mono italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Excel Sheets Tab Bar at Bottom */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-t border-zinc-800 shrink-0 select-none">
          <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar py-0.5 max-w-[70%]">
            {excelSheets.map((sheet, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveSheetIndex(idx);
                  setExcelSearch('');
                }}
                className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all flex items-center space-x-1 border shrink-0 ${
                  activeSheetIndex === idx
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Sheet className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[80px]">{sheet.name}</span>
              </button>
            ))}
          </div>

          <div className="text-[10px] font-mono text-zinc-500">
            已显示 {filteredRows.length} 行 / 共 {activeSheet.rows.length} 行
          </div>
        </div>
      </div>
    );
  }

  // Render PowerPoint Slideshows
  if (fileType === 'powerpoint') {
    const slide = pptSlides[currentSlide];

    return (
      <div className={isMaximized 
        ? "fixed inset-0 z-[100] bg-zinc-950 flex flex-col p-4 md:p-6 animate-in fade-in duration-200"
        : "flex flex-col h-[520px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl transition-all"
      }>
        {/* PPT Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <span className="text-sm">📊</span>
            </div>
            <div>
              <span className="text-xs font-black text-zinc-100">{filename}</span>
              <p className="text-[9px] font-mono text-zinc-500">POWERPOINT PRESENTATION • {pptSlides.length} SLIDES</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Play/Pause Show */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition-all flex items-center space-x-1 cursor-pointer ${
                isPlaying 
                  ? 'bg-amber-600 text-white border-amber-500' 
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Play className="w-3 h-3" />
              <span className="hidden xs:inline">{isPlaying ? '暂停放映' : '自动幻灯'}</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-1 py-0.5 space-x-0.5 shrink-0">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0, prev - 1))}
                disabled={zoomLevel === 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-zinc-500 min-w-[28px] text-center">
                {Math.round(zoomFactors[zoomLevel] * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(zoomFactors.length - 1, prev + 1))}
                disabled={zoomLevel === zoomFactors.length - 1}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Maximize Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title={isMaximized ? "退出全屏 (Esc)" : "全屏放大"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Downloader */}
            <a
              href={url}
              download={filename}
              className="p-2 bg-zinc-950 hover:bg-orange-950 hover:text-orange-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title="下载原始 PPT"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Main Content splits into Slide View or Outline/Side-by-side */}
        <div className="flex-1 flex overflow-hidden bg-zinc-950">
          {/* Left: Slide thumbnails outline list */}
          <div className="w-40 bg-zinc-900/50 border-r border-zinc-800 hidden sm:flex flex-col overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-2 border-b border-zinc-800 shrink-0">
              <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>幻灯片大纲</span>
              </span>
            </div>
            <div className="p-1.5 space-y-1">
              {pptSlides.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentSlide(idx);
                    setIsPlaying(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-all flex flex-col space-y-1 border ${
                    currentSlide === idx
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                      : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-[9px] font-mono font-black text-zinc-500">0{idx + 1}</span>
                  <span className="text-[10px] font-bold truncate w-full">{s.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actual Slide Stage Canvas */}
          <div className="flex-1 flex flex-col p-4 relative justify-center">
            {slide ? (
              <div className="flex-1 flex flex-col justify-between p-6 rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-slate-950 to-zinc-900 relative shadow-2xl overflow-hidden min-h-[220px]">
                {/* Dynamic PPT Slide background accent */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.04),transparent_50%)] pointer-events-none" />
                
                {/* Slide Title */}
                <div className="shrink-0 mb-4 border-b border-zinc-800/80 pb-2">
                  <h2 className={`${getPptTitleClass(zoomLevel)} font-black text-zinc-100 flex items-center space-x-2`}>
                    <span className="text-orange-500 font-mono text-xs shrink-0">SLIDE {currentSlide + 1}</span>
                    <span className="truncate">{slide.title}</span>
                  </h2>
                </div>

                {/* Slide Body bullet points */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                  {slide.bullets && slide.bullets.length > 0 ? (
                    <ul className={getPptBodyClass(zoomLevel)}>
                      {slide.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-zinc-300">
                          <span className="text-orange-400 mt-1 shrink-0">✦</span>
                          <span className="leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={`${getPptBodyClass(zoomLevel)} text-zinc-300 leading-relaxed`}>
                      {slide.content.map((p, idx) => (
                        <p key={idx}>{p}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Speaker Notes Overlay */}
                {showNotes && (
                  <div className="absolute inset-x-0 bottom-0 max-h-[60%] bg-zinc-950/98 border-t border-zinc-800 p-4 overflow-y-auto z-10 animate-in slide-in-from-bottom duration-150">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2">
                      <span className="text-[9px] font-black tracking-wider text-orange-400 uppercase">🎙️ 幻灯片演说备忘录</span>
                      <button onClick={() => setShowNotes(false)} className="text-[9px] text-zinc-500 hover:text-zinc-300 font-black">隐藏</button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
                      {slide.speakerNotes || "（本页幻灯片暂无演说备忘，您可以随时点击右下角编辑大纲补充）"}
                    </p>
                  </div>
                )}

                {/* Slide footer logo */}
                <div className="shrink-0 flex items-center justify-between text-[8px] font-bold text-zinc-600 pt-2 border-t border-zinc-800/40">
                  <span>小逻智脑演示文稿引擎</span>
                  <span>{currentSlide + 1} / {pptSlides.length}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-600 text-xs">
                幻灯片内容加载中...
              </div>
            )}

            {/* Slide Navigation Controllers */}
            <div className="flex items-center justify-between mt-3.5 px-1">
              <div className="flex items-center space-x-1.5">
                <button
                  disabled={currentSlide === 0}
                  onClick={() => {
                    setCurrentSlide(prev => Math.max(0, prev - 1));
                    setIsPlaying(false);
                  }}
                  className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-35 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono font-black text-zinc-400 select-none">
                  SLIDE {currentSlide + 1} / {pptSlides.length}
                </span>
                <button
                  disabled={currentSlide === pptSlides.length - 1}
                  onClick={() => {
                    setCurrentSlide(prev => Math.min(pptSlides.length - 1, prev + 1));
                    setIsPlaying(false);
                  }}
                  className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-35 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Toggle Speaker Notes */}
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black border transition-all flex items-center space-x-1 cursor-pointer ${
                  showNotes 
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>演说逐字稿</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render PDFs
  if (fileType === 'pdf') {
    return (
      <div className={isMaximized 
        ? "fixed inset-0 z-[100] bg-zinc-950 flex flex-col p-4 md:p-6 animate-in fade-in duration-200"
        : "flex flex-col h-[520px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl transition-all"
      }>
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-sm">📄</span>
            </div>
            <div>
              <span className="text-xs font-black text-zinc-100">{filename}</span>
              <p className="text-[9px] font-mono text-zinc-500">PDF READER • {pdfPages.length} PAGES</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Zoom Controls */}
            <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-1 py-0.5 space-x-0.5 shrink-0">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0, prev - 1))}
                disabled={zoomLevel === 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-zinc-500 min-w-[28px] text-center">
                {Math.round(zoomFactors[zoomLevel] * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(zoomFactors.length - 1, prev + 1))}
                disabled={zoomLevel === zoomFactors.length - 1}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
                title="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Maximize Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title={isMaximized ? "退出全屏 (Esc)" : "全屏放大"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Downloader */}
            <a
              href={url}
              download={filename}
              className="p-2 bg-zinc-950 hover:bg-red-950 hover:text-red-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all cursor-pointer"
              title="下载 PDF 文档"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left page numbers */}
          <div className="w-24 bg-zinc-900/50 border-r border-zinc-800 hidden sm:flex flex-col overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-2 border-b border-zinc-800 shrink-0">
              <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase">目录页码</span>
            </div>
            <div className="p-1 space-y-1">
              {pdfPages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPdfPage(idx)}
                  className={`w-full text-left py-1 px-2.5 rounded text-[10px] font-bold font-mono transition-all border ${
                    currentPdfPage === idx
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Page {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Page text display */}
          <div className="flex-1 flex flex-col p-6 bg-zinc-900 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto w-full bg-zinc-950 border border-zinc-800 p-6 rounded-xl shadow-inner min-h-full flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-mono font-black text-zinc-600 block mb-4">PAGE {currentPdfPage + 1} OF {pdfPages.length}</span>
                <p className={`${getPdfBodyClass(zoomLevel)} text-zinc-300 leading-relaxed whitespace-pre-wrap`}>
                  {pdfPages[currentPdfPage] || '（此页文档无文字内容）'}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-6">
                <button
                  disabled={currentPdfPage === 0}
                  onClick={() => setCurrentPdfPage(prev => Math.max(0, prev - 1))}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 disabled:opacity-30 cursor-pointer"
                >
                  上一页
                </button>
                <span className="text-[10px] text-zinc-600 font-mono font-bold">第 {currentPdfPage + 1} 页</span>
                <button
                  disabled={currentPdfPage === pdfPages.length - 1}
                  onClick={() => setCurrentPdfPage(prev => Math.min(pdfPages.length - 1, prev + 1))}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 disabled:opacity-30 cursor-pointer"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Word Docs (.docx)
  return (
    <div className={isMaximized 
      ? "fixed inset-0 z-[100] bg-zinc-950 flex flex-col p-4 md:p-6 animate-in fade-in duration-200"
      : "flex flex-col h-[520px] bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl transition-all"
    }>
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <span className="text-xs font-black text-zinc-100">{filename}</span>
            <p className="text-[9px] font-mono text-zinc-500">WORD DOCUMENT VIEW • {textContent.length.toLocaleString()} CHARS</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="text-[9px] font-mono text-zinc-500 hidden xs:flex items-center space-x-1.5 bg-zinc-950 border border-zinc-800/80 px-2 py-1 rounded-lg">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>阅读约 {Math.ceil(textContent.length / 500) || 1} 分钟</span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-1 py-0.5 space-x-0.5 shrink-0">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0, prev - 1))}
              disabled={zoomLevel === 0}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-zinc-500 min-w-[28px] text-center">
              {Math.round(zoomFactors[zoomLevel] * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(zoomFactors.length - 1, prev + 1))}
              disabled={zoomLevel === zoomFactors.length - 1}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 rounded-md transition-all cursor-pointer"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg border border-zinc-800 transition-all cursor-pointer"
            title={isMaximized ? "退出全屏 (Esc)" : "全屏放大"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <a
            href={url}
            download={filename}
            className="p-2 bg-zinc-950 hover:bg-blue-950 hover:text-blue-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all cursor-pointer"
            title="下载 Word 文档"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Table of Contents sidebar */}
        {tableOfContents.length > 0 && (
          <div className="w-40 bg-zinc-900/50 border-r border-zinc-800 hidden sm:flex flex-col overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-2 border-b border-zinc-800 shrink-0">
              <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase flex items-center space-x-1">
                <Menu className="w-3 h-3" />
                <span>提纲导航</span>
              </span>
            </div>
            <div className="p-1.5 space-y-1">
              {tableOfContents.map((heading, idx) => (
                <div
                  key={idx}
                  className="w-full text-left p-2 text-[10px] font-medium text-zinc-400 select-all truncate border border-transparent rounded hover:bg-zinc-900 hover:text-zinc-200"
                  title={heading}
                >
                  {heading.replace(/^[#\s【】]+/g, '')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Word / Plaintext View */}
        <div className="flex-1 p-6 bg-zinc-900 overflow-y-auto custom-scrollbar">
          <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800/80 p-8 rounded-xl shadow-2xl">
            <article className={`${getWordBodyClass(zoomLevel)} prose-invert max-w-none text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap`}>
              {textContent}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};
