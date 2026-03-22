interface Props {
  sessionId: string;
  saveStatus: "idle" | "saving" | "saved";
  onSave: () => void;
  onToggleSidePanel: () => void;
}

export function TopBar({ sessionId, saveStatus, onSave, onToggleSidePanel }: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 h-14 bg-bg-surface border-b border-border-default shrink-0 min-w-0 overflow-hidden">
      <span className="font-display text-sm md:text-base font-semibold text-gold-bright mr-1 whitespace-nowrap shrink-0">
        ⚔ DnD Battlefield
      </span>

      <button
        onClick={copyCode}
        title="Click to copy link"
        className="text-xs text-text-secondary bg-gold-subtle px-3 py-1 rounded-full border border-border-default cursor-pointer transition-all duration-150 hover:bg-gold-dim hover:border-border-hover shrink-0"
      >
        {sessionId} 📋
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
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
