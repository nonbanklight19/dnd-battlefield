import { useState } from "react";
import type { HeroConfig, HeroType } from "../types.js";
import { HERO_TYPES } from "../types.js";

interface Props {
  configs: HeroConfig[];
  onSave: (configs: HeroConfig[]) => void;
  onClose: () => void;
}

const HERO_LABELS: Record<HeroType, string> = {
  warrior: "⚔️ Warrior",
  wizard:  "🧙 Wizard",
  rogue:   "🗡️ Rogue",
  dwarf:   "🪨 Dwarf",
  triton:  "🌊 Triton",
};

export function HeroConfigModal({ configs, onSave, onClose }: Props) {
  // Build local editable state, one entry per hero type
  const [local, setLocal] = useState<Record<HeroType, { hp: string; ac: string }>>(() => {
    const init = {} as Record<HeroType, { hp: string; ac: string }>;
    for (const type of HERO_TYPES) {
      const saved = configs.find((c) => c.heroType === type);
      init[type] = {
        hp: saved?.hp != null ? String(saved.hp) : "",
        ac: saved?.ac != null ? String(saved.ac) : "",
      };
    }
    return init;
  });

  const handleChange = (type: HeroType, field: "hp" | "ac", value: string) => {
    setLocal((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  const handleSave = () => {
    const updated: HeroConfig[] = HERO_TYPES.map((type) => ({
      heroType: type,
      hp: local[type].hp !== "" ? Number(local[type].hp) : null,
      ac: local[type].ac !== "" ? Number(local[type].ac) : null,
    }));
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg-elevated border border-border-default rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <span className="font-display text-lg text-gold-bright">Hero Defaults</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer text-lg"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="px-6 py-4">
          <p className="text-text-muted text-xs mb-4">
            Set default HP and AC applied when a hero is placed on the map.
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs text-text-secondary pb-2 pr-4">Hero</th>
                <th className="text-center text-xs text-text-secondary pb-2 px-2 w-20">HP</th>
                <th className="text-center text-xs text-text-secondary pb-2 px-2 w-20">AC</th>
              </tr>
            </thead>
            <tbody>
              {HERO_TYPES.map((type) => (
                <tr key={type} className="border-t border-border-default">
                  <td className="py-3 pr-4 text-sm text-text-primary">{HERO_LABELS[type]}</td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      placeholder="—"
                      value={local[type].hp}
                      onChange={(e) => handleChange(type, "hp", e.target.value)}
                      className="w-full bg-bg-deep border border-border-default rounded-md px-2 py-1 text-center text-sm text-text-primary outline-none focus:border-gold-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      placeholder="—"
                      value={local[type].ac}
                      onChange={(e) => handleChange(type, "ac", e.target.value)}
                      className="w-full bg-bg-deep border border-border-default rounded-md px-2 py-1 text-center text-sm text-text-primary outline-none focus:border-gold-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-transparent border border-border-default text-text-secondary text-sm rounded-lg cursor-pointer hover:border-border-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="py-2 px-5 bg-gold-dim border border-gold-muted text-gold-bright text-sm font-semibold rounded-lg cursor-pointer hover:bg-gold-subtle transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

