import type { InitiativeState } from "../types.js";

interface Props {
  initiative: InitiativeState;
}

export function InitiativeOverlay({ initiative }: Props) {
  const { rows, activeIndex, round } = initiative;

  if (rows.length === 0) return null;

  return (
    <div
      className="absolute left-3 top-3 z-10 pointer-events-none select-none"
      style={{ minWidth: 130, maxWidth: 190 }}
    >
      <div
        className="rounded-lg border border-border-default"
        style={{ background: "rgba(10, 12, 7, 0.82)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border-default">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-display leading-none px-1">
            Initiative
          </span>
          <span className="text-[10px] font-display text-gold-bright leading-none px-1">
            Round {round}
          </span>
        </div>

        {/* Rows */}
        <div className="py-1" style={{ maxHeight: 260, overflowY: "auto" }}>
          {rows.map((row, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={row.id}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs leading-5 ${
                  isActive
                    ? "bg-gold-subtle text-gold-bright font-semibold"
                    : "text-text-secondary"
                }`}
              >
                <span
                  className="shrink-0 text-[8px] leading-none"
                  style={{ width: 8, opacity: isActive ? 1 : 0 }}
                >
                  ▶
                </span>
                <span className="truncate">{row.name || "—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



