import { useState, useRef } from "react";
import type { Token, GridMode } from "../types.js";

interface Props {
  tokens: Token[];
  gridMode: GridMode;
  gridSize: number;
  onAddToken: (data: { name: string; color: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
  onUploadMap: (file: File) => void;
  onGridModeChange: (mode: GridMode) => void;
  onGridSizeChange: (size: number) => void;
  visible: boolean;
}

const PRESET_COLORS = [
  "#e05252", "#f59e0b", "#4ade80", "#3b82f6",
  "#7c6dec", "#ec4899", "#6b7280", "#e8e0d0",
];

const GRID_MODES: GridMode[] = ["none", "square", "hex"];

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-default last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 cursor-pointer transition-colors duration-150 hover:bg-bg-hover bg-transparent border-none"
      >
        <span className="text-xs uppercase tracking-[1.5px] text-gold-muted font-medium">
          {title}
        </span>
        <span
          className="text-[11px] text-text-muted transition-transform duration-150"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          ▼
        </span>
      </button>
      <div className={`panel-content ${open ? "" : "collapsed"}`}>
        <div>
          <div className="px-5 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidePanel({
  tokens, gridMode, gridSize,
  onAddToken, onRemoveToken, onUploadMap,
  onGridModeChange, onGridSizeChange, visible,
}: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddToken({ name: name.trim(), color, x: 100, y: 100 });
    setName("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadMap(file);
  };

  return (
    <div className="w-[20vw] min-w-[240px] max-w-[360px] bg-bg-surface border-l border-border-default overflow-y-auto overflow-x-hidden flex-shrink-0">
      {/* Grid Setup — collapsed by default */}
      <CollapsibleSection title="Grid Setup" defaultOpen={false}>
        <div className="flex gap-1 bg-bg-deep rounded-lg p-1.5 border border-border-default mb-4">
          {GRID_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onGridModeChange(mode)}
              className={`flex-1 py-2 px-3 text-sm rounded-md text-center cursor-pointer transition-all duration-150 border-none ${
                gridMode === mode
                  ? "bg-gold-dim text-gold-bright"
                  : "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        {gridMode !== "none" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Size</span>
            <input
              type="range"
              min={20}
              max={120}
              value={gridSize}
              onChange={(e) => onGridSizeChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-text-muted min-w-[32px] text-right">
              {gridSize}px
            </span>
          </div>
        )}
      </CollapsibleSection>

      {/* Battle Map */}
      <CollapsibleSection title="Battle Map">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-border-hover rounded-lg p-8 text-center text-text-muted text-sm cursor-pointer transition-all duration-150 bg-bg-deep hover:border-gold-muted hover:bg-gold-subtle hover:text-text-secondary"
        >
          <div className="text-3xl mb-3">🗺</div>
          Drop image or click to upload
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </CollapsibleSection>

      {/* Add Token */}
      <CollapsibleSection title="Add Token">
        <input
          type="text"
          placeholder="Token name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="w-full py-2.5 px-3.5 bg-bg-deep border border-border-default rounded-lg text-text-primary text-sm outline-none transition-all duration-150 focus:border-gold-muted focus:shadow-[0_0_0_3px_rgba(202,169,104,0.15)] mb-4"
        />
        <div className="flex gap-2 flex-wrap mb-4">
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full cursor-pointer transition-all duration-150 hover:scale-115"
              style={{
                background: c,
                border: c === color ? "2px solid var(--color-gold-bright)" : "2px solid transparent",
                boxShadow: c === color ? "0 0 8px rgba(202,169,104,0.3)" : "none",
              }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="w-full py-2.5 bg-gold-dim text-gold-bright border border-border-hover rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-gold-subtle hover:border-gold-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Token
        </button>
      </CollapsibleSection>

      {/* Tokens list */}
      <CollapsibleSection title={`Tokens (${tokens.length})`}>
        <div className="flex flex-col gap-2">
          {tokens.length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">No tokens yet</p>
          )}
          {tokens.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-3 py-3 px-3.5 bg-bg-deep rounded-lg border border-transparent transition-all duration-150 hover:border-border-default hover:bg-bg-elevated"
            >
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ background: t.color }}
              />
              <span className="flex-1 text-sm text-text-primary">{t.name}</span>
              <button
                onClick={() => onRemoveToken(t.id)}
                className="text-sm text-text-muted cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-danger bg-transparent border-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
