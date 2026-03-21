import { useState } from "react";
import type { Token } from "../types.js";

interface Props {
  tokens: Token[];
  onAddToken: (data: { name: string; color: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
  onUploadMap: (file: File) => void;
  visible: boolean;
}

const PRESET_COLORS = ["#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff", "#44ffff", "#ff8800", "#ffffff"];

export function SidePanel({ tokens, onAddToken, onRemoveToken, onUploadMap, visible }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  if (!visible) return null;

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddToken({ name: name.trim(), color, x: 100, y: 100 });
    setName("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadMap(file);
  };

  const sectionStyle: React.CSSProperties = {
    padding: "1rem", borderBottom: "1px solid #e2b71433",
  };

  return (
    <div style={{
      width: "260px", background: "#16213e", borderLeft: "1px solid #e2b71444",
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#e2b714" }}>Battle Map</h3>
        <label style={{
          display: "block", padding: "0.5rem", background: "#1a1a2e", borderRadius: "4px",
          textAlign: "center", cursor: "pointer", border: "1px dashed #e2b71466",
        }}>
          Upload Image
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        </label>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#e2b714" }}>Add Token</h3>
        <input
          type="text"
          placeholder="Token name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          style={{
            width: "100%", padding: "0.4rem", background: "#1a1a2e", color: "#eee",
            border: "1px solid #e2b71444", borderRadius: "4px", marginBottom: "0.5rem",
          }}
        />
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: "24px", height: "24px", borderRadius: "50%", background: c,
                cursor: "pointer", border: c === color ? "2px solid white" : "2px solid transparent",
              }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          style={{
            width: "100%", padding: "0.4rem", background: "#e2b714", color: "#1a1a2e",
            border: "none", borderRadius: "4px", cursor: name.trim() ? "pointer" : "not-allowed",
            fontWeight: "bold", opacity: name.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>

      <div style={{ ...sectionStyle, flex: 1, borderBottom: "none" }}>
        <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#e2b714" }}>
          Tokens ({tokens.length})
        </h3>
        {tokens.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.3rem 0", fontSize: "0.85rem",
            }}
          >
            <div style={{
              width: "16px", height: "16px", borderRadius: "50%", background: t.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1 }}>{t.name}</span>
            <button
              onClick={() => onRemoveToken(t.id)}
              style={{
                background: "none", border: "none", color: "#ff4444",
                cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem",
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
