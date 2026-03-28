import { useState } from "react";
import type { AoeType, AoeColor, AoeEffect } from "../types.js";
import { AOE_COLOR_HEX, AOE_COLOR_MAP } from "./AoeShape.js";

const SHAPES: { type: AoeType; icon: string; label: string }[] = [
  { type: "circle", icon: "◉", label: "Circle" },
  { type: "cone",   icon: "▷", label: "Cone"   },
  { type: "line",   icon: "▬", label: "Line"   },
  { type: "square", icon: "■", label: "Square" },
];

const FEET_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 90, 120, 150, 200, 300];

const COLORS: { key: AoeColor; label: string }[] = [
  { key: "fire",      label: "Fire"      },
  { key: "cold",      label: "Cold"      },
  { key: "lightning", label: "Lightning" },
  { key: "poison",    label: "Poison"    },
  { key: "necrotic",  label: "Necrotic"  },
  { key: "radiant",   label: "Radiant"   },
  { key: "psychic",   label: "Psychic"   },
];

interface Props {
  open: boolean;
  onClose: () => void;
  effects: AoeEffect[];
  placing: boolean;
  onStartPlace: (type: AoeType, feet: number, color: AoeColor, originSize: 1 | 2 | 3) => void;
  onCancelPlace: () => void;
  onDeleteEffect: (id: string) => void;
  onClearAll: () => void;
}

export function AoePanel({ open, onClose, effects, placing, onStartPlace, onCancelPlace, onDeleteEffect, onClearAll }: Props) {
  const [shape, setShape] = useState<AoeType>("circle");
  const [feet, setFeet] = useState<number>(30);
  const [color, setColor] = useState<AoeColor>("fire");
  const [originSize, setOriginSize] = useState<1 | 2 | 3>(1);

  if (!open) return null;

  const handlePlace = () => {
    if (placing) {
      onCancelPlace();
    } else {
      onStartPlace(shape, feet, color, originSize);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-bg-elevated border border-border-default rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <span className="font-display text-lg text-gold-bright">Area of Effect</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-5">
          {/* Shape */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">Shape</span>
            <div className="grid grid-cols-4 gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setShape(s.type)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-xs cursor-pointer transition-all duration-150 ${
                    shape === s.type
                      ? "border-gold-muted bg-gold-subtle text-gold-bright"
                      : "border-border-default bg-transparent text-text-secondary hover:border-border-hover"
                  }`}
                >
                  <span className="text-lg leading-none">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">Size</span>
            <select
              value={feet}
              onChange={(e) => setFeet(Number(e.target.value))}
              className="w-full bg-bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer focus:outline-none focus:border-border-hover"
            >
              {FEET_OPTIONS.map((f) => (
                <option key={f} value={f}>{f} ft</option>
              ))}
            </select>
          </div>

          {/* Origin size */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">Origin Size</span>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setOriginSize(s)}
                  className={`py-2 rounded-lg border text-xs cursor-pointer transition-all duration-150 ${
                    originSize === s
                      ? "border-gold-muted bg-gold-subtle text-gold-bright"
                      : "border-border-default bg-transparent text-text-secondary hover:border-border-hover"
                  }`}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
          </div>

          {/* Color / damage type */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-2 block">Type</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((col) => (
                <button
                  key={col.key}
                  title={col.label}
                  onClick={() => setColor(col.key)}
                  className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all duration-150 ${
                    color === col.key
                      ? "scale-110 border-white"
                      : "border-transparent opacity-60 hover:opacity-90 hover:scale-105"
                  }`}
                  style={{ background: AOE_COLOR_HEX[col.key] }}
                />
              ))}
            </div>
          </div>

          {/* Place button */}
          <button
            onClick={handlePlace}
            className={`w-full py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all duration-150 ${
              placing
                ? "bg-red-900/30 border-red-700/50 text-red-400 hover:bg-red-900/50"
                : "bg-gold-subtle border-gold-muted text-gold-bright hover:bg-gold-dim"
            }`}
          >
            {placing ? "⏹ Cancel Placement" : "🎯 Place on Map"}
          </button>

          {/* Placed effects list */}
          {effects.length > 0 && (
            <div className="border-t border-border-default pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">
                  Placed ({effects.length})
                </span>
                <button
                  onClick={onClearAll}
                  className="text-[10px] text-text-muted hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none uppercase tracking-wider"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                {effects.map((e) => {
                  const strokeColor = AOE_COLOR_MAP[e.color].stroke;
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-bg-surface"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: strokeColor }}
                      />
                      <span className="text-xs text-text-secondary flex-1 capitalize">
                        {e.feet} ft {e.type}
                      </span>
                      <button
                        onClick={() => onDeleteEffect(e.id)}
                        className="text-text-muted hover:text-red-400 transition-colors text-base cursor-pointer bg-transparent border-none leading-none"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


