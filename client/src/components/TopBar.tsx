import type { GridMode } from "../types.js";

interface Props {
  sessionId: string;
  gridMode: GridMode;
  gridSize: number;
  onGridModeChange: (mode: GridMode) => void;
  onGridSizeChange: (size: number) => void;
  onSave: () => void;
  onToggleSidePanel: () => void;
}

export function TopBar({
  sessionId, gridMode, gridSize,
  onGridModeChange, onGridSizeChange, onSave, onToggleSidePanel,
}: Props) {
  const copyCode = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const buttonStyle: React.CSSProperties = {
    padding: "0.4rem 0.8rem", background: "#16213e", color: "#e2b714",
    border: "1px solid #e2b714", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem",
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle, background: "#e2b714", color: "#1a1a2e",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 1rem",
      background: "#16213e", borderBottom: "1px solid #e2b71444",
    }}>
      <button onClick={copyCode} style={buttonStyle} title="Click to copy link">
        {sessionId}
      </button>

      <div style={{ display: "flex", gap: "0.25rem" }}>
        {(["none", "square", "hex"] as GridMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onGridModeChange(mode)}
            style={gridMode === mode ? activeButtonStyle : buttonStyle}
          >
            {mode}
          </button>
        ))}
      </div>

      {gridMode !== "none" && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          Size:
          <input
            type="range"
            min={20}
            max={120}
            value={gridSize}
            onChange={(e) => onGridSizeChange(Number(e.target.value))}
            style={{ width: "100px" }}
          />
          {gridSize}px
        </label>
      )}

      <div style={{ flex: 1 }} />

      <button onClick={onSave} style={buttonStyle}>Save</button>
      <button onClick={onToggleSidePanel} style={buttonStyle}>Menu</button>
    </div>
  );
}
