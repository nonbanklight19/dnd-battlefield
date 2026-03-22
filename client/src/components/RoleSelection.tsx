import type { Role } from "../types.js";

interface Props {
  onSelect: (role: Role) => void;
}

export function RoleSelection({ onSelect }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deepest/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8 p-10 bg-bg-elevated border border-border-default rounded-2xl shadow-2xl max-w-sm w-full mx-4">
        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-3xl text-gold-bright">⚔ Choose Your Role</span>
          <p className="text-text-secondary text-sm text-center">
            Select how you'll participate in this session
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={() => onSelect("dm")}
            className="group flex flex-col items-center gap-2 p-6 bg-gold-subtle border border-border-default rounded-xl cursor-pointer transition-all duration-200 hover:bg-gold-dim hover:border-border-hover hover:shadow-lg"
          >
            <span className="text-4xl">👑</span>
            <span className="font-display text-lg text-gold-bright">Dungeon Master</span>
            <span className="text-text-muted text-xs text-center">
              Full control — manage tokens, maps and the battlefield
            </span>
          </button>

          <button
            onClick={() => onSelect("player")}
            className="group flex flex-col items-center gap-2 p-6 bg-gold-subtle border border-border-default rounded-xl cursor-pointer transition-all duration-200 hover:bg-gold-dim hover:border-border-hover hover:shadow-lg"
          >
            <span className="text-4xl">🧙</span>
            <span className="font-display text-lg text-gold-bright">Player</span>
            <span className="text-text-muted text-xs text-center">
              Join the adventure — move your hero and explore the map
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

