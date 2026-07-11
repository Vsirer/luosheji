import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Check, Trash2, Undo, Redo, ImageIcon, Upload, Target, User, Move, Maximize2, 
  RotateCw, Square, Hand, RefreshCcw, Search, Settings2, Sparkles, ChevronDown, Box, ChevronRight, Zap, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Person {
  id: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  pose: string;
  thickness: number;
  rotation: number;
  rotationY: number;
  flipH: boolean;
  flipV: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Line {
  id: string;
  points: Point[];
  color: string;
  thickness: number;
  showNumber?: boolean;
}

type EditorMode = 'hand' | 'character' | 'line';

interface PointAndShootEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (markedImageData: string) => void;
  initialImage?: string | null;
  isEmbedded?: boolean;
}

export const PointAndShootEditor: React.FC<PointAndShootEditorProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  initialImage,
  isEmbedded = false
}) => {
  const getCleanImageUrl = (src: string | null | undefined): string | null => {
    if (!src) return null;
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
      return src;
    }
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return `/api/proxy-asset?url=${encodeURIComponent(src)}`;
    }
    return src;
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(getCleanImageUrl(initialImage));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<EditorMode>('character');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<{persons: Person[], lines: Line[]}[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [activeColor, setActiveColor] = useState('#ff0000');
  const [lineThickness, setLineThickness] = useState(3);
  const [defaultShowNumber, setDefaultShowNumber] = useState(true);
  const [isDraggingLine, setIsDraggingLine] = useState(false);
  const [draggingLinePointIdx, setDraggingLinePointIdx] = useState<number | null>(null);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });
  
  const colors = [
    { name: '红色', value: '#ff0000' },
    { name: '蓝色', value: '#0000ff' },
    { name: '黄色', value: '#ffff00' },
    { name: '绿色', value: '#00ff00' },
    { name: '紫色', value: '#a855f7' },
    { name: '橙色', value: '#f97316' },
  ];

  useEffect(() => {
    if (initialImage) {
      setImage(getCleanImageUrl(initialImage));
    }
  }, [initialImage]);

  // Handle history
  useEffect(() => {
    if (persons.length === 0 && lines.length === 0 && history.length === 0) {
      setHistory([{ persons: [], lines: [] }]);
      setHistoryStep(0);
    }
  }, []);

  const saveToHistory = (newPersons: Person[], newLines: Line[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({ persons: [...newPersons], lines: [...newLines] });
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setPersons([...history[newStep].persons]);
      setLines([...history[newStep].lines]);
      setHistoryStep(newStep);
      setSelectedId(null);
      setSelectedLineId(null);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setPersons([...history[newStep].persons]);
      setLines([...history[newStep].lines]);
      setHistoryStep(newStep);
      setSelectedId(null);
      setSelectedLineId(null);
    }
  };

  const drawPerson = (ctx: CanvasRenderingContext2D, person: Person, isSelected: boolean, indexNumber?: number) => {
    const { x, y, scale, color, pose = 'reset', thickness = 1.0, rotation = 0, rotationY = 0, flipH = false, flipV = false } = person;
    const baseWidth = 40;
    const baseHeight = 80;
    
    // Y-axis rotation simulation (0-360 deg)
    const yRotationRad = (rotationY * Math.PI) / 180;
    const widthFactor = Math.cos(yRotationRad);
    
    const w = baseWidth * scale * thickness;
    const h = baseHeight * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.scale(widthFactor, 1); // Use scale to handle rotationY, avoiding negative dimensions in drawing calls
    
    // Draw silhouette
    ctx.fillStyle = color;
    
    // Different poses logic
    if (pose === 'reset') {
      // Head
      ctx.beginPath();
      ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1);
      ctx.fill();
      // Legs
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Arms
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      ctx.fillRect(w * 0.37, -h * 0.65, w * 0.15, h * 0.35);
    } else if (pose === 'fig1') {
      // Elegant professional stance
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      // Legs
      ctx.fillRect(-w * 0.28, -h * 0.3, w * 0.2, h * 0.3);
      ctx.fillRect(w * 0.08, -h * 0.3, w * 0.2, h * 0.3);
      // Hand on hip and other hand slightly raised
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.25);
      ctx.rotate(0.3); ctx.fillRect(w * 0.35, -h * 0.7, w * 0.15, h * 0.35); ctx.rotate(-0.3);
    } else if (pose === 'fig2') {
      // Reaching pointing stance (red-box alignment / director cue)
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      // Pointing arm straight out with a bright accent
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(w * 0.35, -h * 0.65, w * 0.5, w * 0.18);
      ctx.fillStyle = color;
    } else if (pose === 'fig3') {
      // Active dynamic athletic stance
      ctx.rotate(0.08);
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      // Wide legs
      ctx.fillRect(-w * 0.42, -h * 0.3, w * 0.2, h * 0.3);
      ctx.fillRect(w * 0.2, -h * 0.3, w * 0.2, h * 0.3);
      // Both arms up/bending
      ctx.rotate(-0.4); ctx.fillRect(-w * 0.65, -h * 0.8, w * 0.15, h * 0.4); ctx.rotate(0.4);
      ctx.rotate(0.4); ctx.fillRect(w * 0.45, -h * 0.8, w * 0.15, h * 0.4); ctx.rotate(-0.4);
    } else if (pose === 'walk') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      // Walking legs (staggered)
      ctx.fillRect(-w * 0.35, -h * 0.3, w * 0.22, h * 0.25);
      ctx.fillRect(w * 0.1, -h * 0.3, w * 0.22, h * 0.35);
      // Walking arms (counter-staggered)
      ctx.fillRect(-w * 0.55, -h * 0.65, w * 0.15, h * 0.4);
      ctx.fillRect(w * 0.4, -h * 0.65, w * 0.15, h * 0.2);
    } else if (pose === 'run') {
       ctx.rotate(0.15); // Lean forward
       ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
       ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
       // Running legs
       ctx.rotate(-0.3); ctx.fillRect(-w * 0.4, -h * 0.3, w * 0.2, h * 0.25); ctx.rotate(0.3);
       ctx.rotate(0.2); ctx.fillRect(w * 0.1, -h * 0.3, w * 0.2, h * 0.4); ctx.rotate(-0.2);
       // Running arms
       ctx.rotate(0.4); ctx.fillRect(-w * 0.6, -h * 0.7, w * 0.15, h * 0.3); ctx.rotate(-0.4);
       ctx.rotate(-0.4); ctx.fillRect(w * 0.45, -h * 0.7, w * 0.15, h * 0.3); ctx.rotate(0.4);
    } else if (pose === 'sit') {
       ctx.translate(0, h * 0.3);
       ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
       ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
       // L-shape legs
       ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.6, w * 0.2);
       ctx.fillRect(w * 0.1, -h * 0.3, w * 0.6, w * 0.2);
    } else if (pose === 'wave') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      // Waving arm up
      ctx.rotate(-0.5); ctx.fillRect(w * 0.5, -h * 1.1, w * 0.15, h * 0.5); ctx.rotate(0.5);
    } else if (pose === 'lie') {
      ctx.rotate(Math.PI / 2);
      ctx.translate(h * 0.4, 0);
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.4); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.4);
    } else if (pose === 'point') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      // Pointing arm
      ctx.fillRect(w * 0.35, -h * 0.65, w * 0.5, w * 0.15);
    } else if (pose === 'hips') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Arms on hips (bent)
      ctx.beginPath(); ctx.moveTo(-w * 0.35, -h * 0.6); ctx.lineTo(-w * 0.6, -h * 0.45); ctx.lineTo(-w * 0.35, -h * 0.35); ctx.lineWidth = w * 0.15; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.35, -h * 0.6); ctx.lineTo(w * 0.6, -h * 0.45); ctx.lineTo(w * 0.35, -h * 0.35); ctx.stroke();
    } else if (pose === 'victory') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Both arms up
      ctx.rotate(-0.8); ctx.fillRect(-w * 0.7, -h * 1.0, w * 0.15, h * 0.5); ctx.rotate(0.8);
      ctx.rotate(0.8); ctx.fillRect(w * 0.5, -h * 1.0, w * 0.15, h * 0.5); ctx.rotate(-0.8);
    } else if (pose === 'crouch') {
      ctx.translate(0, h * 0.4);
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.3, w * 0.1); ctx.fill();
      // Bent legs
      ctx.fillRect(-w * 0.35, -h * 0.4, w * 0.25, h * 0.2);
      ctx.fillRect(w * 0.1, -h * 0.4, w * 0.25, h * 0.2);
    } else if (pose === 'talk') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Gesturing arm
      ctx.rotate(-0.3); ctx.fillRect(-w * 0.6, -h * 0.6, w * 0.15, h * 0.3); ctx.rotate(0.3);
      ctx.rotate(0.3); ctx.fillRect(w * 0.45, -h * 0.6, w * 0.15, h * 0.3); ctx.rotate(-0.3);
    } else if (pose === 'think') {
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Hand to chin
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      ctx.beginPath(); ctx.moveTo(w * 0.35, -h * 0.6); ctx.lineTo(w * 0.2, -h * 0.8); ctx.lineWidth = w * 0.1; ctx.stroke();
    } else if (pose === 'alert') {
      ctx.translate(0, h * 0.1);
      ctx.rotate(0.05);
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      // Wide stance legs
      ctx.fillRect(-w * 0.45, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(w * 0.2, -h * 0.3, w * 0.22, h * 0.3);
      // Defensive arms
      ctx.fillRect(-w * 0.6, -h * 0.6, w * 0.4, w * 0.15);
      ctx.fillRect(w * 0.2, -h * 0.65, w * 0.4, w * 0.15);
    } else if (pose === 'tired') {
      ctx.rotate(0.1);
      ctx.beginPath(); ctx.arc(w * 0.1, -h * 0.8, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      // Slumped arms
      ctx.fillRect(-w * 0.45, -h * 0.65, w * 0.15, h * 0.45);
      ctx.fillRect(w * 0.3, -h * 0.65, w * 0.15, h * 0.45);
    } else {
      // Default generic silhouette
      ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.roundRect(-w * 0.35, -h * 0.7, w * 0.7, h * 0.4, w * 0.1); ctx.fill();
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.08, -h * 0.3, w * 0.22, h * 0.3);
      ctx.fillRect(-w * 0.52, -h * 0.65, w * 0.15, h * 0.35);
      ctx.fillRect(w * 0.37, -h * 0.65, w * 0.15, h * 0.35);
    }

    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      if (pose === 'lie') {
          // Compensate for rotation in selection box
          ctx.strokeRect(-w * 0.6, -h, w * 1.2, h * 1.1);
      } else {
          ctx.strokeRect(-w * 0.6, -h, w * 1.2, h * 1.1);
      }
      
      // Control points for visual only
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(w * 0.6, -h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();

    // Draw sequence number annotation (small white circle, labeled color border) above character if indexNumber is provided
    if (indexNumber !== undefined) {
      ctx.save();
      const labelX = x;
      const labelY = y - Math.max(30, h * 1.05) - 6;

      // Outer shadow for extra elegance and legibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // White solid circle background
      ctx.beginPath();
      ctx.arc(labelX, labelY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Clear shadows for text and border
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Coordinate border matching silhouette color
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bold numeric label
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 11px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(indexNumber.toString(), labelX, labelY + 0.5);

      ctx.restore();
    }
  };

  const drawLine = (ctx: CanvasRenderingContext2D, line: Line, isSelected: boolean, indexNumber?: number) => {
    if (!line || !line.points || line.points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(line.points[0].x, line.points[0].y);
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(line.points[i].x, line.points[i].y);
    }
    
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.stroke();

    // Trace backwards from the end to find a stable direction point
    const p1 = line.points[line.points.length - 1];
    let p2 = line.points[line.points.length - 2] || line.points[0];
    
    for (let i = line.points.length - 2; i >= 0; i--) {
      const dist = Math.hypot(p1.x - line.points[i].x, p1.y - line.points[i].y);
      if (dist >= 15) {
        p2 = line.points[i];
        break;
      }
    }

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const len = Math.hypot(dx, dy);
    
    if (len > 0) {
      const angle = Math.atan2(dy, dx);
      const arrowLength = Math.max(12, line.thickness * 3);
      const arrowAngle = Math.PI / 6; // 30 degrees
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - arrowLength * Math.cos(angle - arrowAngle),
        p1.y - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(
        p1.x - arrowLength * Math.cos(angle + arrowAngle),
        p1.y - arrowLength * Math.sin(angle + arrowAngle)
      );
      
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();
    }

    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      // Select stroke of the main line
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      ctx.stroke();

      // Draw end-points control handles
      ctx.setLineDash([]);
      
      // Start point handle
      ctx.beginPath();
      ctx.arc(line.points[0].x, line.points[0].y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b30';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // End point handle
      ctx.beginPath();
      ctx.arc(line.points[line.points.length - 1].x, line.points[line.points.length - 1].y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b30';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Draw sequence number near arrow head if line.showNumber is true
    if (line.showNumber && indexNumber !== undefined) {
      ctx.save();
      const offsetDist = 16;
      let labelX = p1.x;
      let labelY = p1.y - offsetDist;

      if (len > 0) {
        const dx_norm = dx / len;
        const dy_norm = dy / len;
        labelX = p1.x + dx_norm * offsetDist;
        labelY = p1.y + dy_norm * offsetDist;
      }

      // Outer shadow for extra elegance and legibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // White solid circle background
      ctx.beginPath();
      ctx.arc(labelX, labelY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Clear shadows for text and border
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Coordinate border matching line color
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bold numeric label
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 11px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(indexNumber.toString(), labelX, labelY + 0.5);

      ctx.restore();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || !image) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Track last mouse position for dragging delta
    lastMousePos.current = { x, y };

    if (mode === 'hand') {
      // 1. Check if clicking on an existing person
      let foundPersonId: string | null = null;
      for (let i = persons.length - 1; i >= 0; i--) {
        const p = persons[i];
        const w = 40 * p.scale;
        const h = 80 * p.scale;
        if (x >= p.x - w * 0.6 && x <= p.x + w * 0.6 && y >= p.y - h && y <= p.y + h * 0.1) {
          foundPersonId = p.id;
          break;
        }
      }

      if (foundPersonId) {
        setSelectedId(foundPersonId);
        setSelectedLineId(null);
        setIsDragging(true);
        const p = persons.find(p => p.id === foundPersonId)!;
        setDragOffset({ x: x - p.x, y: y - p.y });
        return;
      }

      // 2. Check if clicking on the control points of the SELECTED line (if any)
      if (selectedLineId) {
        const selLine = lines.find(l => l.id === selectedLineId);
        if (selLine && selLine.points.length > 0) {
          const startPt = selLine.points[0];
          const endPt = selLine.points[selLine.points.length - 1];
          const distStart = Math.hypot(startPt.x - x, startPt.y - y);
          const distEnd = Math.hypot(endPt.x - x, endPt.y - y);

          if (distStart < 15) {
            setIsDraggingLine(true);
            setDraggingLinePointIdx(0);
            setSelectedId(null);
            return;
          } else if (distEnd < 15) {
            setIsDraggingLine(true);
            setDraggingLinePointIdx(selLine.points.length - 1);
            setSelectedId(null);
            return;
          }
        }
      }

      // 3. Check if clicking on an existing line generally
      let foundLineId: string | null = null;
      let clickedPointIdx: number | null = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        // Check endpoints first
        const startPt = l.points[0];
        const endPt = l.points[l.points.length - 1];
        if (Math.hypot(startPt.x - x, startPt.y - y) < 15) {
          foundLineId = l.id;
          clickedPointIdx = 0;
          break;
        }
        if (Math.hypot(endPt.x - x, endPt.y - y) < 15) {
          foundLineId = l.id;
          clickedPointIdx = l.points.length - 1;
          break;
        }

        // Check closeness to any point on the line
        const isNear = l.points.some(p => Math.sqrt((p.x - x)**2 + (p.y - y)**2) < 12);
        if (isNear) {
          foundLineId = l.id;
          clickedPointIdx = -1; // drag entire line
          break;
        }
      }

      if (foundLineId) {
        setSelectedLineId(foundLineId);
        setSelectedId(null);
        setIsDraggingLine(true);
        setDraggingLinePointIdx(clickedPointIdx);
      } else {
        // Clicked empty space: deselect
        setSelectedId(null);
        setSelectedLineId(null);
      }
    } else if (mode === 'character') {
      // Check if clicking on an existing person
      let foundId: string | null = null;
      for (let i = persons.length - 1; i >= 0; i--) {
        const p = persons[i];
        const w = 40 * p.scale;
        const h = 80 * p.scale;
        if (x >= p.x - w * 0.6 && x <= p.x + w * 0.6 && y >= p.y - h && y <= p.y + h * 0.1) {
          foundId = p.id;
          break;
        }
      }

      if (foundId) {
        setSelectedId(foundId);
        setSelectedLineId(null);
        setIsDragging(true);
        const p = persons.find(p => p.id === foundId)!;
        setDragOffset({ x: x - p.x, y: y - p.y });
      } else {
        // Add a new person
        const newPerson: Person = {
          id: 'p-' + Date.now(),
          x,
          y,
          scale: 1,
          color: activeColor,
          pose: 'reset',
          thickness: 1.0,
          rotation: 0,
          rotationY: 0,
          flipH: false,
          flipV: false
        };
        const newPersons = [...persons, newPerson];
        setPersons(newPersons);
        setSelectedId(newPerson.id);
        setSelectedLineId(null);
        saveToHistory(newPersons, lines);
      }
    } else if (mode === 'line') {
      // Check if clicking on an existing line (simple distance check to points for selection)
      let foundLineId: string | null = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        const isNear = l.points.some(p => Math.sqrt((p.x - x)**2 + (p.y - y)**2) < 10);
        if (isNear) {
          foundLineId = l.id;
          break;
        }
      }

      if (foundLineId) {
        setSelectedLineId(foundLineId);
        setSelectedId(null);
      } else {
        setIsDrawingLine(true);
        setCurrentLine([{ x, y }]);
        setSelectedLineId(null);
        setSelectedId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && selectedId) {
      setPersons(prev => prev.map(p => 
        p.id === selectedId 
          ? { ...p, x: x - dragOffset.x, y: y - dragOffset.y } 
          : p
      ));
    } else if (isDraggingLine && selectedLineId) {
      const dx = x - lastMousePos.current.x;
      const dy = y - lastMousePos.current.y;
      
      setLines(prev => prev.map(l => {
        if (l.id === selectedLineId) {
          if (draggingLinePointIdx === null || draggingLinePointIdx === -1) {
            // Drag the entire line
            return {
              ...l,
              points: l.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          } else {
            // Drag only the specific endpoint
            return {
              ...l,
              points: l.points.map((p, idx) => 
                idx === draggingLinePointIdx 
                  ? { x, y } 
                  : p
              )
            };
          }
        }
        return l;
      }));
    } else if (isDrawingLine) {
      setCurrentLine(prev => [...prev, { x, y }]);
    }

    lastMousePos.current = { x, y };
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      saveToHistory(persons, lines);
    } else if (isDraggingLine) {
      setIsDraggingLine(false);
      setDraggingLinePointIdx(null);
      saveToHistory(persons, lines);
    } else if (isDrawingLine) {
      setIsDrawingLine(false);
      if (currentLine.length > 1) {
        const newLine: Line = {
          id: 'l-' + Date.now(),
          points: currentLine,
          color: activeColor,
          thickness: lineThickness,
          showNumber: defaultShowNumber
        };
        const newLines = [...lines, newLine];
        setLines(newLines);
        setSelectedLineId(newLine.id);
        saveToHistory(persons, newLines);
      }
      setCurrentLine([]);
    }
  };

  const updateScale = (val: number) => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, scale: val } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const updatePose = (val: string) => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, pose: val } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const updateThickness = (val: number) => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, thickness: val } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const updateRotation = (val: number) => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, rotation: val } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const updateRotationY = (val: number) => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, rotationY: val } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };
  
  const toggleFlipH = () => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, flipH: !p.flipH } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const toggleFlipV = () => {
    if (selectedId) {
      const newPersons = persons.map(p => p.id === selectedId ? { ...p, flipV: !p.flipV } : p);
      setPersons(newPersons);
      saveToHistory(newPersons, lines);
    }
  };

  const updateLineThickness = (val: number) => {
    if (selectedLineId) {
      const newLines = lines.map(l => l.id === selectedLineId ? { ...l, thickness: val } : l);
      setLines(newLines);
      saveToHistory(persons, newLines);
    } else {
      setLineThickness(val);
    }
  };

  const toggleLineMarker = () => {
    if (selectedLineId) {
      const targetLine = lines.find(l => l.id === selectedLineId);
      if (targetLine) {
        const nextVal = !targetLine.showNumber;
        const newLines = lines.map(l => l.id === selectedLineId ? { ...l, showNumber: nextVal } : l);
        setLines(newLines);
        setDefaultShowNumber(nextVal);
        saveToHistory(persons, newLines);
      }
    } else {
      setDefaultShowNumber(prev => !prev);
    }
  };

  const deleteSelected = () => {
    if (selectedId) {
      const newPersons = persons.filter(p => p.id !== selectedId);
      setPersons(newPersons);
      setSelectedId(null);
      saveToHistory(newPersons, lines);
    } else if (selectedLineId) {
      const newLines = lines.filter(l => l.id !== selectedLineId);
      setLines(newLines);
      setSelectedLineId(null);
      saveToHistory(persons, newLines);
    }
  };

  const clear = () => {
    setPersons([]);
    setLines([]);
    setSelectedId(null);
    setSelectedLineId(null);
    saveToHistory([], []);
  };

  // Resize and draw logic
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (image && containerRef.current) {
        const img = new Image();
        img.onload = () => {
          const container = containerRef.current!;
          const rect = container.getBoundingClientRect();
          
          const maxWidth = rect.width - 64;
          const maxHeight = rect.height - 64;
          
          let w = img.width;
          let h = img.height;

          const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
          w *= ratio;
          h *= ratio;

          setCanvasSize({ width: w, height: h });
        };
        img.src = image;
      }
    };

    updateSize();
    // Use a small delay to catch the end of flex layout animations if necessary
    const timer = setTimeout(updateSize, 350); 
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [image, selectedId]);

  const bgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (image) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgImageRef.current = img;
        drawCanvas();
      };
      img.src = image;
    }
  }, [image]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImageRef.current || canvasSize.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
    
    persons.forEach((person, idx) => {
      try {
        drawPerson(ctx, person, selectedId === person.id, idx + 1);
      } catch (err) {
        console.error("Error drawing person:", err);
      }
    });

    lines.forEach((line, idx) => {
      try {
        drawLine(ctx, line, selectedLineId === line.id, idx + 1);
      } catch (err) {
        console.error("Error drawing line:", err);
      }
    });

    if (isDrawingLine && currentLine.length > 1) {
      drawLine(ctx, { 
        id: 'temp', 
        points: currentLine, 
        color: activeColor, 
        thickness: lineThickness 
      }, false);
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [persons, selectedId, lines, selectedLineId, isDrawingLine, currentLine, canvasSize, activeColor, lineThickness]);

  const handleSave = () => {
    if (canvasRef.current) {
      // Re-draw without selection rectangles before export
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        persons.forEach((p, idx) => drawPerson(ctx, p, false, idx + 1));
        lines.forEach((l, idx) => drawLine(ctx, l, false, idx + 1));
        
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
      };
      img.src = image!;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setPersons([]);
        setLines([]);
        setHistory([{ persons: [], lines: [] }]);
        setHistoryStep(0);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const selectedPerson = persons.find(p => p.id === selectedId);
  const selectedLine = lines.find(l => l.id === selectedLineId);

  const renderInner = () => (
    <div 
      className={cn(
        "relative bg-[#1a1a1a] border border-white/10 overflow-hidden flex flex-col w-full text-white",
        isEmbedded ? "h-[380px] rounded-2xl" : "h-[90vh] rounded-[32px] shadow-2xl"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {!isEmbedded && (
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <Target className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-widest uppercase">指哪打哪 - 标记人物</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">在场景中点击放置人物，可调整颜色与大小</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tools (Left) */}
          <div className="w-20 border-r border-white/10 flex flex-col items-center py-4 justify-between h-full shrink-0 bg-[#161616] select-none">
            {/* Top Group */}
            <div className="flex flex-col items-center space-y-4 w-full">
              <button 
                onClick={() => document.getElementById('scene-upload-2')?.click()}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all group"
                title="上传场景"
              >
                <Upload className="w-5 h-5 shrink-0" />
                <input type="file" id="scene-upload-2" className="hidden" accept="image/*" onChange={handleFileChange} />
              </button>

              <div className="w-10 h-px bg-white/5" />

              {/* Mode Selection */}
              <div className="flex flex-col space-y-2 w-full items-center">
                <button
                  onClick={() => {
                    setMode('hand');
                    setSelectedId(null);
                    setSelectedLineId(null);
                  }}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border",
                    mode === 'hand' 
                      ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" 
                      : "bg-white/5 border-transparent text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                  title="选择与拖动 (Hand Tool)"
                >
                  <Hand className="w-5 h-5 shrink-0" />
                </button>
                <button
                  onClick={() => {
                    setMode('character');
                    setSelectedId(null);
                    setSelectedLineId(null);
                  }}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border",
                    mode === 'character' 
                      ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" 
                      : "bg-white/5 border-transparent text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                  title="添加人物"
                >
                  <User className="w-5 h-5 shrink-0" />
                </button>
                <button
                  onClick={() => {
                    setMode('line');
                    setSelectedId(null);
                    setSelectedLineId(null);
                  }}
                  className={cn(
                    "p-2.5 rounded-xl transition-all border",
                    mode === 'line' 
                      ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" 
                      : "bg-white/5 border-transparent text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                  title="绘制线条"
                >
                  <RotateCw className="w-5 h-5 -scale-x-100 shrink-0" />
                </button>
              </div>

              <div className="w-10 h-px bg-white/5" />

              {/* Compact 2-column Color Palette */}
              <div className="grid grid-cols-2 gap-2 justify-items-center w-full max-w-[56px] px-1">
                {colors.map(c => (
                  <button
                    key={c.value}
                    onClick={() => {
                      setActiveColor(c.value);
                      if (selectedId) {
                        const newPersons = persons.map(p => p.id === selectedId ? { ...p, color: c.value } : p);
                        setPersons(newPersons);
                        saveToHistory(newPersons, lines);
                      } else if (selectedLineId) {
                        const newLines = lines.map(l => l.id === selectedLineId ? { ...l, color: c.value } : l);
                        setLines(newLines);
                        saveToHistory(persons, newLines);
                      }
                    }}
                    className={cn(
                      "w-5 h-5 rounded-full border transition-all shrink-0",
                      activeColor === c.value ? "border-white scale-110 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Group (Undo, Redo, Delete) - Repositioned Higher to Ensure Full Visibility */}
            <div className="flex flex-col items-center space-y-3 w-full px-2">
              <div className="w-10 h-px bg-white/5 mb-1" />
              
              <div className="grid grid-cols-2 gap-1.5 w-full justify-items-center max-w-[56px]">
                <button 
                  onClick={undo}
                  disabled={historyStep <= 0}
                  className="p-1.5 disabled:opacity-30 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-all shrink-0 flex items-center justify-center w-6 h-6"
                  title="撤销"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  className="p-1.5 disabled:opacity-30 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-all shrink-0 flex items-center justify-center w-6 h-6"
                  title="重做"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </div>

              <button 
                onClick={deleteSelected}
                disabled={!selectedId && !selectedLineId}
                className="p-2 disabled:opacity-30 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-100 hover:text-red-300 transition-all shrink-0 w-8 h-8 flex items-center justify-center"
                title="删除选中"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Canvas Area */}
          <div ref={containerRef} className="flex-1 bg-black/60 flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all duration-500">
            {!image ? (
                <div 
                  onClick={() => document.getElementById('scene-upload-2')?.click()}
                  className="w-full max-w-md aspect-video border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center space-y-4 hover:bg-white/5 cursor-pointer transition-all group"
                >
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-8 h-8 text-slate-700" />
                    </div>
                    <p className="text-slate-500 font-bold text-xs">点击上传背景场景图</p>
                </div>
            ) : (
                <div className="relative shadow-2xl transition-all duration-500">
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className="rounded-2xl cursor-crosshair bg-neutral-900"
                    />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center space-x-2 pointer-events-none">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">
                          {mode === 'hand' 
                            ? '拖动小人或线条（可选中后调节端点）' 
                            : mode === 'character' 
                              ? '点击放置并拖动人物' 
                              : '在画布上按住并滑动绘制线条'}
                        </span>
                    </div>
                </div>
            )}
          </div>

          {/* Right Sidebar Adjustment Panel */}
          {image && (
            <div className="border-l border-white/10 bg-[#161616] h-full flex flex-col overflow-hidden w-80 shrink-0 animate-fade-in">
              <div className="w-80 h-full flex flex-col overflow-y-auto">
                <div className="p-6 space-y-8 flex-1 flex flex-col justify-between">
                  <div className="space-y-8">
                    {mode === 'character' || (mode === 'hand' && selectedId) ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center space-x-2">
                            <User className="w-4 h-4 text-red-500 mr-1" />
                            <span>人物调节 (ADJUST)</span>
                          </h3>
                          {selectedId && (
                            <button 
                              onClick={() => setSelectedId(null)}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
                              title="取消选中"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {!selectedId && (
                          <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-2xl text-[10px] leading-relaxed flex items-start space-x-2.5">
                            <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                            <span>提示：请在左侧点击或拖拽生成人物，并点击选中画布中的人物进行调节。</span>
                          </div>
                        )}

                        <div className={cn("space-y-6 transition-all duration-300", !selectedId && "opacity-45 pointer-events-none select-none")}>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center space-x-2">
                                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">缩放比例</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-red-500">{Math.round((selectedPerson?.scale || 1) * 100)}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0.2" 
                              max="5" 
                              step="0.1" 
                              value={selectedPerson?.scale || 1}
                              onChange={(e) => updateScale(parseFloat(e.target.value))}
                              disabled={!selectedId}
                              className="w-full accent-red-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center space-x-2">
                                <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">变换与翻转 (Transform)</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={toggleFlipH}
                                disabled={!selectedId}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-2xl transition-all border space-y-1.5",
                                  selectedPerson?.flipH 
                                    ? "bg-red-500/10 border-red-500/40 text-white" 
                                    : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                )}
                                title="水平翻转"
                              >
                                <RefreshCcw className="w-4 h-4" />
                                <span className="text-[8px] font-bold">水平翻转 (Mirror)</span>
                              </button>
                              <button
                                onClick={toggleFlipV}
                                disabled={!selectedId}
                                className={cn(
                                  "flex flex-col items-center justify-center p-3 rounded-2xl transition-all border space-y-1.5",
                                  selectedPerson?.flipV 
                                    ? "bg-red-500/10 border-red-500/40 text-white" 
                                    : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                )}
                                title="垂直翻转"
                              >
                                <ChevronDown className="w-4 h-4 rotate-180" />
                                <span className="text-[8px] font-bold">垂直翻转 (Flip)</span>
                              </button>
                              <button
                                onClick={() => updateRotation(((selectedPerson?.rotation || 0) + 90) % 360)}
                                disabled={!selectedId}
                                className="flex flex-col items-center justify-center p-3 rounded-2xl transition-all border space-y-1.5 bg-white/5 border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                title="顺时针旋转90度"
                              >
                                <RotateCw className="w-4 h-4" />
                                <span className="text-[8px] font-bold">旋转 90° (Rotate)</span>
                              </button>
                            </div>

                            <div className="pt-2">
                              <div className="flex items-center justify-between px-1 mb-3">
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Y轴自转 (360° Spin)</span>
                                 <span className="text-[10px] font-mono font-bold text-red-500">{Math.round(selectedPerson?.rotationY || 0)}°</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="360" 
                                step="1" 
                                value={selectedPerson?.rotationY || 0}
                                onChange={(e) => updateRotationY(parseFloat(e.target.value))}
                                disabled={!selectedId}
                                className="w-full accent-red-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                            </div>

                            <div className="pt-4">
                              <div className="flex items-center justify-between px-1 mb-3">
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">平面旋转</span>
                                 <span className="text-[10px] font-mono font-bold text-red-500">{Math.round(selectedPerson?.rotation || 0)}°</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="360" 
                                step="1" 
                                value={selectedPerson?.rotation || 0}
                                onChange={(e) => updateRotation(parseFloat(e.target.value))}
                                disabled={!selectedId}
                                className="w-full accent-red-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">身材体型</p>
                              <span className="text-[10px] font-mono font-bold text-red-500">{(selectedPerson?.thickness || 1.0).toFixed(1)}x</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {[
                                { id: 0.7, label: '身材：轻盈 (Slim)' },
                                { id: 1.0, label: '身材：标准 (Standard)' },
                                { id: 1.5, label: '身材：强壮 (Strong)' },
                              ].map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => updateThickness(t.id)}
                                  disabled={!selectedId}
                                  className={cn(
                                    "px-4 py-3 rounded-2xl text-[10px] font-bold text-left transition-all border",
                                    Math.abs((selectedPerson?.thickness || 1.0) - t.id) < 0.1
                                      ? "bg-red-500/10 border-red-500/40 text-white"
                                      : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                  )}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">预设姿态 (基础动作)</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'fig1', label: '图1姿势', icon: User },
                                { id: 'fig2', label: '图2姿势', icon: Target },
                                { id: 'fig3', label: '图3姿势', icon: Sparkles },
                                { id: 'reset', label: '标准站姿', icon: User },
                                { id: 'walk', label: '行走动作', icon: Move },
                                { id: 'run', label: '疾跑冲刺', icon: Zap },
                                { id: 'talk', label: '交谈演说', icon: RotateCw },
                                { id: 'point', label: '指向引导', icon: Square },
                                { id: 'wave', label: '挥手致意', icon: Hand },
                                { id: 'hips', label: '叉腰站立', icon: RefreshCcw },
                                { id: 'think', label: '思考状态', icon: Search },
                                { id: 'alert', label: '戒备姿态', icon: Settings2 },
                                { id: 'victory', label: '庆祝胜利', icon: Sparkles },
                                { id: 'crouch', label: '下蹲姿态', icon: ChevronDown },
                                { id: 'sit', label: '端坐模式', icon: Box },
                                { id: 'lie', label: '侧卧小憩', icon: Hand },
                                { id: 'tired', label: '疲惫不堪', icon: ChevronRight },
                              ].map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => updatePose(p.id)}
                                  disabled={!selectedId}
                                  className={cn(
                                    "flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all border",
                                    selectedPerson?.pose === p.id 
                                      ? "bg-red-500/10 border-red-500/40 text-white" 
                                      : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                  )}
                                >
                                  <p.icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[10px] font-bold">{p.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : mode === 'line' || (mode === 'hand' && selectedLineId) ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center space-x-2">
                            <RotateCw className="w-4 h-4 text-red-500 -scale-x-100 mr-1" />
                            <span>线条调节 (LINE)</span>
                          </h3>
                          {selectedLineId && (
                            <button 
                              onClick={() => setSelectedLineId(null)}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
                              title="取消选中"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                标记设置 (MARKER)
                              </span>
                            </div>
                            
                            <button
                              onClick={toggleLineMarker}
                              className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left",
                                (selectedLineId ? selectedLine?.showNumber : defaultShowNumber)
                                  ? "bg-red-500/10 border-red-500/40 text-white shadow-lg shadow-red-500/5"
                                  : "bg-white/5 border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/10"
                              )}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0",
                                  (selectedLineId ? selectedLine?.showNumber : defaultShowNumber) ? "bg-red-500 text-white" : "bg-white/5 text-slate-400"
                                )}>
                                  <Check className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold font-sans">是否需要标记</p>
                                  <p className="text-[9px] text-slate-500 mt-0.5">在箭头头部绘制序号标注</p>
                                </div>
                              </div>
                              
                              <div className={cn(
                                "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0",
                                (selectedLineId ? selectedLine?.showNumber : defaultShowNumber) ? "bg-red-500" : "bg-zinc-700"
                              )}>
                                <div className={cn(
                                  "w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
                                  (selectedLineId ? selectedLine?.showNumber : defaultShowNumber) ? "translate-x-4" : "translate-x-0"
                                )} />
                              </div>
                            </button>
                          </div>
                          
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] text-slate-500 leading-relaxed italic">
                            提示：点击画布其他地方清空选择，或切换颜色重新绘制。
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center space-x-2">
                            <Hand className="w-4 h-4 text-red-500 mr-1" />
                            <span>选择与调节 (SELECT)</span>
                          </h3>
                        </div>

                        <div className="space-y-6">
                          <div className="p-4 bg-red-500/5 border border-red-500/25 rounded-2xl flex flex-col space-y-3 animate-fade-in">
                            <div className="flex items-center space-x-2 text-red-400">
                              <Hand className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-black">选择与位置调整模式</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                              在该模式下，您可以直接对画布中的元素进行位置调整：
                            </p>
                            <ul className="text-[10px] text-slate-500 space-y-2 pl-4 list-disc font-medium">
                              <li>按住并拖拽 <strong className="text-slate-300">小人</strong> 改变其位置。</li>
                              <li>按住并拖拽 <strong className="text-slate-300">整条线条</strong> 整体平移。</li>
                              <li>点击选中一条线后，拖拽其两端的 <strong className="text-red-400">红色圆圈</strong> 即可调节两端坐标。</li>
                            </ul>
                          </div>

                          <div className="p-3.5 bg-zinc-900/40 border border-white/5 text-slate-500 rounded-2xl text-[10px] leading-relaxed flex items-start space-x-2.5">
                            <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                            <span>提示：在画布中点击对应的元素，可在右侧激活高级调节面板（如缩放、自转、姿势、是否标记等）。</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <button 
                      onClick={deleteSelected}
                      disabled={!selectedId && !selectedLineId}
                      className={cn(
                        "w-full flex items-center justify-center space-x-2 p-4 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-2xl transition-all border border-red-500/10 group disabled:opacity-20 disabled:pointer-events-none"
                      )}
                    >
                      <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">移除选中内容</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={cn("border-t border-white/10 flex items-center justify-between bg-black/20 shrink-0", isEmbedded ? "p-3" : "p-6")}>
          {!isEmbedded ? (
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500">
               <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                 <User className="w-2.5 h-2.5 text-white" />
               </div>
               <span>提示：在场景中放置对应颜色的小人，AI将自动匹配对应角色的光影与比例。</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-[9px] font-bold text-slate-500">
               <div className="w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                 <User className="w-2 h-2 text-white" />
               </div>
               <span>拖动标记人物</span>
            </div>
          )}
          <div className="flex items-center space-x-2 shrink-0">
             {!isEmbedded && (
               <button 
                 onClick={onClose}
                 className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
               >
                  取消
               </button>
             )}
             <button 
               onClick={handleSave}
               disabled={!image}
               className={cn(
                 "bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black uppercase tracking-widest transition-all shadow-lg flex items-center space-x-2 shrink-0",
                 isEmbedded 
                   ? "px-4 py-2 rounded-xl text-[10px] shadow-red-500/10" 
                   : "px-8 py-3 rounded-2xl text-xs shadow-red-500/20"
               )}
             >
                <Check className={cn(isEmbedded ? "w-3 h-3" : "w-4 h-4")} />
                <span>部署人物并保存</span>
             </button>
          </div>
        </div>
      </div>
  );

  if (isEmbedded) {
    return renderInner();
  }

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-[95vw] h-[90vh] bg-[#1a1a1a] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {renderInner()}
      </motion.div>
    </div>
  );
};

