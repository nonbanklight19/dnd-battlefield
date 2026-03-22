import { useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket.js";
import { useInitiative } from "../hooks/useInitiative.js";
import { useHeroConfig } from "../hooks/useHeroConfig.js";
import { HeroConfigModal } from "./HeroConfigModal.js";
import type { InitiativeRow } from "../types.js";

interface Props {
  sessionId: string;
}

function NumberInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className={`w-full bg-transparent outline-none text-center text-sm text-text-primary placeholder:text-text-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className ?? ""}`}
    />
  );
}

export function InitiativeTracker({ sessionId }: Props) {
  const socket = useSocket();
  const { state, addRow, updateRow, removeRow, sort, next, clear, reorder, importRows } = useInitiative(socket, sessionId);
  const { configs: heroConfigs, saveConfigs: saveHeroConfigs } = useHeroConfig(socket);
  const { rows, activeIndex, round } = state;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [showHeroConfig, setShowHeroConfig] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Track pending updates per field to debounce
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const debounce = (key: string, fn: () => void, delay = 400) => {
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  };

  const handleField = (row: InitiativeRow, field: keyof Omit<InitiativeRow, "id">, value: string | number | null) => {
    updateRow(row.id, { [field]: value });
    debounce(`${row.id}-${field}`, () => {}, 0); // flush immediately — updateRow already emits
  };

  const handlePointerDown = (e: React.PointerEvent, fromIdx: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(fromIdx);
    setOverIndex(fromIdx);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    // Find which row the pointer is over by checking bounding rects
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        setOverIndex(i);
        break;
      }
    }
  };

  const handlePointerUp = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      reorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleExport = () => {
    const data = rows.map(({ id: _id, tokenId: _tid, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `initiative-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error("Expected an array");
        const clean = parsed.map((r: Record<string, unknown>) => ({
          initiative: r.initiative != null ? Number(r.initiative) : null,
          name: String(r.name ?? ""),
          hp: r.hp != null ? Number(r.hp) : null,
          ac: r.ac != null ? Number(r.ac) : null,
        }));
        importRows(clean);
      } catch {
        alert("Invalid initiative file. Expected a JSON array.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div
      className="flex flex-col h-screen bg-bg-deep text-text-primary font-body select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {showHeroConfig && (
        <HeroConfigModal
          configs={heroConfigs}
          onSave={saveHeroConfigs}
          onClose={() => setShowHeroConfig(false)}
        />
      )}
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40px" }} />
            <col style={{ width: "60px" }} />
            <col />
            <col style={{ width: "60px" }} />
            <col style={{ width: "60px" }} />
            <col style={{ width: "40px" }} />
          </colgroup>
          <thead>
            <tr className="bg-bg-elevated">
              <th className="border border-border-hover p-0" />
              <th className="border border-border-hover py-3 px-4 text-sm font-medium text-text-secondary text-center tracking-wide">In-ve</th>
              <th className="border border-border-hover py-3 px-4 text-sm font-medium text-text-secondary text-left tracking-wide">Name</th>
              <th className="border border-border-hover py-3 px-4 text-sm font-medium text-text-secondary text-center tracking-wide">HP</th>
              <th className="border border-border-hover py-3 px-4 text-sm font-medium text-text-secondary text-center tracking-wide">AC</th>
              <th className="border border-border-hover p-0" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isActive = idx === activeIndex;
              const isDragging = dragIndex === idx;
              const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;

              return (
                <tr
                  key={row.id}
                  ref={(el) => { rowRefs.current[idx] = el; }}
                  className={`transition-colors duration-100 ${
                    isDragging
                      ? "opacity-40"
                      : isOver
                        ? "outline outline-2 outline-emerald-400"
                        : isActive
                          ? "bg-emerald-800/60"
                          : "bg-bg-surface hover:bg-bg-elevated"
                  }`}
                >
                  {/* Drag handle */}
                  <td className="border border-border-hover text-center text-text-muted">
                    <span
                      className="block w-full py-3 text-xs cursor-grab active:cursor-grabbing touch-none"
                      onPointerDown={(e) => handlePointerDown(e, idx)}
                    >
                      ⠿
                    </span>
                  </td>

                  {/* Initiative */}
                  <td className="border border-border-hover px-2">
                    <NumberInput
                      value={row.initiative}
                      placeholder="—"
                      onChange={(v) => handleField(row, "initiative", v)}
                    />
                  </td>

                  {/* Name */}
                  <td className="border border-border-hover px-3">
                    <input
                      type="text"
                      placeholder="Name"
                      value={row.name}
                      onChange={(e) => handleField(row, "name", e.target.value)}
                      className="w-full bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
                    />
                  </td>

                  {/* HP */}
                  <td className="border border-border-hover px-2">
                    <NumberInput
                      value={row.hp}
                      placeholder="—"
                      onChange={(v) => handleField(row, "hp", v)}
                    />
                  </td>

                  {/* AC */}
                  <td className="border border-border-hover px-2">
                    <NumberInput
                      value={row.ac}
                      placeholder="—"
                      onChange={(v) => handleField(row, "ac", v)}
                    />
                  </td>

                  {/* Delete */}
                  <td className="border border-border-hover text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      title="Remove"
                      className="w-full h-full py-3 flex items-center justify-center bg-red-800/80 hover:bg-red-700 transition-colors duration-150 cursor-pointer border-none text-white"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex items-center justify-center py-16 text-text-muted text-sm">
            No combatants yet — click <span className="mx-1.5 text-emerald-400 font-medium">＋</span> to add one
          </div>
        )}
      </div>

      {/* Footer toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-border-default bg-bg-surface">
        {/* NEXT */}
        <button
          onClick={next}
          disabled={rows.length === 0}
          className="py-2 px-5 border border-emerald-500 text-emerald-400 text-sm font-semibold tracking-widest rounded cursor-pointer transition-all duration-150 hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
        >
          NEXT
        </button>

        {/* SORT */}
        <button
          onClick={sort}
          disabled={rows.length === 0}
          className="py-2 px-5 border border-blue-400 text-blue-400 text-sm font-semibold tracking-widest rounded cursor-pointer transition-all duration-150 hover:bg-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
        >
          SORT
        </button>

        {/* OPTIONS */}
        <div className="relative">
          <button
            onClick={() => setOptionsOpen((v) => !v)}
            className="py-2 px-5 border border-border-hover text-text-secondary text-sm font-semibold tracking-widest rounded cursor-pointer transition-all duration-150 hover:bg-bg-elevated bg-transparent"
          >
            OPTIONS ▾
          </button>
          {optionsOpen && (
            <div
              className="absolute bottom-full mb-2 left-0 bg-bg-elevated border border-border-default rounded-lg shadow-xl overflow-hidden z-10 min-w-36"
              onMouseLeave={() => setOptionsOpen(false)}
            >
              <button
                onClick={() => { setShowHeroConfig(true); setOptionsOpen(false); }}
                className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-bg-hover transition-colors cursor-pointer bg-transparent border-none"
              >
                🦸 Heroes
              </button>
              <div className="h-px bg-border-default" />
              <button
                onClick={() => { handleExport(); setOptionsOpen(false); }}
                disabled={rows.length === 0}
                className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-bg-hover transition-colors cursor-pointer bg-transparent border-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ⬇ Export
              </button>
              <button
                onClick={() => { importInputRef.current?.click(); setOptionsOpen(false); }}
                className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-bg-hover transition-colors cursor-pointer bg-transparent border-none"
              >
                ⬆ Import
              </button>
              <div className="h-px bg-border-default" />
              <button
                onClick={() => { setOptionsOpen(false); if (window.confirm("Clear all initiative rows and reset the round counter?")) clear(); }}
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/30 transition-colors cursor-pointer bg-transparent border-none"
              >
                🗑 Clear
              </button>
            </div>
          )}
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="hidden"
        />

        {/* Round + add */}
        <div className="flex-1 flex items-center justify-end gap-4">
          <span className="text-text-primary font-semibold text-base">
            Round {round}
          </span>

          <button
            onClick={addRow}
            title="Add combatant"
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-bold flex items-center justify-center cursor-pointer transition-colors duration-150 border-none shadow-lg"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}


