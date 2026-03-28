import type { Role } from "../types.js";

interface Props {
  sessionId: string;
  saveStatus: "idle" | "saving" | "saved";
  onSave: () => void;
  onToggleSidePanel: () => void;
  role: Role | null;
  rulerActive: boolean;
  onToggleRuler: () => void;
  aoeOpen: boolean;
  onToggleAoe: () => void;
}

export function TopBar({ sessionId, saveStatus, onSave, onToggleSidePanel, role, rulerActive, onToggleRuler, aoeOpen, onToggleAoe }: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const roleLabel = role === "dm" ? "👑 DM" : role === "player" ? "🧙 Player" : null;

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 h-16 md:h-14 bg-bg-surface border-b border-border-default shrink-0 min-w-0 overflow-hidden">
      {/* Title + sub-row stacked on mobile, inline on desktop */}
      <div className="flex flex-col md:flex-row md:items-center md:gap-3 shrink-0 mr-1">
        <span className="font-display text-sm md:text-base font-semibold text-gold-bright leading-tight whitespace-nowrap">
          ⚔ DnD Battlefield
        </span>
        {/* Sub-row: visible always on mobile, inline on md+ */}
        <div className="flex items-center gap-2 mt-0.5 md:mt-0">
          <button
            onClick={copyCode}
            title="Click to copy link"
            className="text-[10px] md:text-xs text-text-secondary bg-gold-subtle px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-border-default cursor-pointer transition-all duration-150 hover:bg-gold-dim hover:border-border-hover leading-tight"
          >
            {sessionId} 📋
          </button>
          {roleLabel && (
            <span className="text-[10px] md:text-xs font-display text-gold-bright bg-gold-dim px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-border-hover leading-tight">
              {roleLabel}
            </span>
          )}
        </div>
      </div>

      {role === "dm" && (
        <a
          href={`/${sessionId}/initiative`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open Initiative Tracker"
          className="text-xs text-text-secondary bg-gold-subtle px-3 py-1 rounded-full border border-border-default cursor-pointer transition-all duration-150 hover:bg-gold-dim hover:border-border-hover shrink-0 no-underline"
        >
          ⚡ Initiative
        </a>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1">
      <button
        onClick={onToggleAoe}
        title="Area of Effect"
        className={`w-10 h-10 flex items-center justify-center border rounded-lg text-base cursor-pointer transition-all duration-150 ${
          aoeOpen
            ? "bg-gold-subtle border-gold-muted text-gold-bright"
            : "bg-transparent border-transparent text-text-secondary hover:text-gold-bright hover:bg-gold-subtle hover:border-border-default"
        }`}
      >
        🎯
      </button>
      <button
        onClick={onToggleRuler}
        title={rulerActive ? "Ruler active — click to deactivate" : "Ruler tool (measure distance)"}
        className={`w-10 h-10 flex items-center justify-center border rounded-lg text-base cursor-pointer transition-all duration-150 ${
          rulerActive
            ? "bg-gold-subtle border-gold-muted text-gold-bright"
            : "bg-transparent border-transparent text-text-secondary hover:text-gold-bright hover:bg-gold-subtle hover:border-border-default"
        }`}
      >
        📏
      </button>
      <button
        onClick={onSave}
        disabled={saveStatus === "saving"}
        title="Save"
        className={`w-10 h-10 flex items-center justify-center border rounded-lg text-base cursor-pointer transition-all duration-150 ${
          saveStatus === "saved"
            ? "bg-green-900/30 border-green-700 text-green-400"
            : saveStatus === "saving"
              ? "bg-transparent border-transparent text-text-muted cursor-wait"
              : "bg-transparent border-transparent text-text-secondary hover:text-gold-bright hover:bg-gold-subtle hover:border-border-default"
        }`}
      >
        {saveStatus === "saved" ? "\u2713" : saveStatus === "saving" ? "\u23F3" : "\uD83D\uDCBE"}
      </button>
      <button
        onClick={onToggleSidePanel}
        title="Toggle panel"
        className="w-10 h-10 flex items-center justify-center bg-transparent border border-transparent rounded-lg text-text-secondary text-base cursor-pointer transition-all duration-150 hover:text-gold-bright hover:bg-gold-subtle hover:border-border-default"
      >
        ☰
      </button>
      </div>
    </div>
  );
}
