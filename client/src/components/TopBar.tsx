interface Props {
  sessionId: string;
  onSave: () => void;
  onToggleSidePanel: () => void;
}

export function TopBar({ sessionId, onSave, onToggleSidePanel }: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="flex items-center gap-4 px-6 h-14 bg-bg-surface border-b border-border-default">
      <span className="font-display text-base font-semibold text-gold-bright mr-1">
        ⚔ DnD Battlefield
      </span>

      <button
        onClick={copyCode}
        title="Click to copy link"
        className="text-xs text-text-secondary bg-gold-subtle px-3 py-1 rounded-full border border-border-default cursor-pointer transition-all duration-150 hover:bg-gold-dim hover:border-border-hover"
      >
        {sessionId} 📋
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
      <button
        onClick={onSave}
        title="Save"
        className="w-10 h-10 flex items-center justify-center bg-transparent border border-transparent rounded-lg text-text-secondary text-base cursor-pointer transition-all duration-150 hover:text-gold-bright hover:bg-gold-subtle hover:border-border-default"
      >
        💾
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
