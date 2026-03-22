import { useState, useRef } from "react";

const PRESET_ICONS = ["\u{1F479}", "\u{1F480}", "\u{1F409}", "\u{1F577}\uFE0F", "\u{1F43A}", "\u{1F9DF}", "\u{1F47B}", "\u{1F987}", "\u{1F40D}", "\u{1F9CC}", "\u{1F525}", "\u26A1"];

const PRESET_COLORS = [
  "#e05252", "#f59e0b", "#4ade80", "#3b82f6",
  "#7c6dec", "#ec4899", "#6b7280", "#e8e0d0",
];

interface Props {
  sessionId: string;
  onAddEnemy: (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => void;
}

export function EnemyForm({ sessionId, onAddEnemy }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddEnemy({
      name: name.trim(),
      color,
      icon,
      ...(customImage ? { customImage } : {}),
      x: 100,
      y: 100,
    });
    setName("");
    setCustomImage(null);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("icon", file);
    const res = await fetch(`/api/sessions/${sessionId}/enemy-icon`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setCustomImage(data.imageUrl);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enemy name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        className="w-full py-2.5 px-3.5 bg-bg-deep border border-border-default rounded-lg text-text-primary text-sm outline-none transition-all duration-150 focus:border-gold-muted focus:shadow-[0_0_0_3px_rgba(202,169,104,0.15)] mb-4"
      />

      <span className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-2">Icon</span>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {PRESET_ICONS.map((ic) => (
          <div
            key={ic}
            onClick={() => { setIcon(ic); setCustomImage(null); }}
            className="w-8 h-8 rounded-md flex items-center justify-center text-lg cursor-pointer transition-all duration-150"
            style={{
              background: icon === ic && !customImage ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: icon === ic && !customImage
                ? "2px solid var(--color-gold-bright, #caa968)"
                : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {ic}
          </div>
        ))}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm cursor-pointer transition-all duration-150 text-text-muted hover:text-text-primary"
          style={{
            background: customImage ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
            border: customImage
              ? "2px solid var(--color-gold-bright, #caa968)"
              : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {customImage ? "\u2713" : "\u2191"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleIconUpload}
          className="hidden"
        />
      </div>

      <span className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-2">Color</span>
      <div className="flex gap-2 flex-wrap mb-4">
        {PRESET_COLORS.map((c) => (
          <div
            key={c}
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full cursor-pointer transition-all duration-150 hover:scale-115"
            style={{
              background: c,
              border: c === color ? "2px solid var(--color-gold-bright, #caa968)" : "2px solid transparent",
              boxShadow: c === color ? "0 0 8px rgba(202,169,104,0.3)" : "none",
            }}
          />
        ))}
      </div>

      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        className="w-full py-2.5 bg-gold-dim text-gold-bright border border-border-hover rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-gold-subtle hover:border-gold-muted disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Add Enemy
      </button>
    </div>
  );
}
