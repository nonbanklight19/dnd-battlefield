import { useState, useRef, useEffect } from "react";
import type { Token, GridMode } from "../types.js";
import { HeroPicker } from "./HeroPicker.js";
import { EnemyForm } from "./EnemyForm.js";

interface Props {
  tokens: Token[];
  gridMode: GridMode;
  gridSize: number;
  sessionId: string;
  onAddHero: (data: { heroType: string; x: number; y: number }) => void;
  onAddEnemy: (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
  onUploadMap: (file: File) => void;
  onGridModeChange: (mode: GridMode) => void;
  onGridSizeChange: (size: number) => void;
  visible: boolean;
  onClose: () => void;
  getViewCenter: () => { x: number; y: number };
}

const GRID_MODES: GridMode[] = ["none", "square", "hex"];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

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
  tokens, gridMode, gridSize, sessionId,
  onAddHero, onAddEnemy, onRemoveToken, onUploadMap,
  onGridModeChange, onGridSizeChange, visible, onClose, getViewCenter,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadMap(file);
  };

  if (!isMobile && !visible) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {visible && isMobile && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <div
        className={[
          "bg-bg-surface border-border-default overflow-y-auto overflow-x-hidden shrink-0",
          // Mobile: fixed bottom drawer
          "fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] border-t rounded-t-2xl transition-transform duration-300 ease-in-out",
          // Desktop: static sidebar
          "md:static md:w-[20vw] md:min-w-60 md:max-w-90 md:border-l md:border-t-0 md:rounded-none md:max-h-none md:z-auto",
          visible ? "translate-y-0" : "translate-y-full md:translate-y-0 md:hidden",
        ].join(" ")}
      >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-border-hover" />
        </div>
      )}
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
            <span className="text-xs text-text-muted min-w-8 text-right">
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

      {/* Place Hero */}
      <CollapsibleSection title="Place Hero">
        <HeroPicker tokens={tokens} onAddHero={onAddHero} onRemoveToken={onRemoveToken} getViewCenter={getViewCenter} />
      </CollapsibleSection>

      {/* Add Enemy */}
      <CollapsibleSection title="Add Enemy">
        <EnemyForm sessionId={sessionId} onAddEnemy={onAddEnemy} getViewCenter={getViewCenter} />
      </CollapsibleSection>

      {/* Tokens list */}
      <CollapsibleSection title={`Tokens (${tokens.length})`}>
        <div className="flex flex-col gap-2">
          {tokens.length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">No tokens yet</p>
          )}
          {tokens.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 py-3 px-3.5 bg-bg-deep rounded-lg border border-transparent transition-all duration-150 hover:border-border-default hover:bg-bg-elevated">
              {t.kind === "hero" ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full shrink-0 bg-text-muted" />
                  <span className="flex-1 text-sm text-text-primary capitalize">{t.heroType}</span>
                </>
              ) : (
                <>
                  <span className="text-sm shrink-0">{t.icon}</span>
                  <span className="flex-1 text-sm text-text-primary">{t.name}</span>
                  <button onClick={() => onRemoveToken(t.id)} className="text-sm text-text-muted cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-danger bg-transparent border-none">✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
    </>
  );
}
