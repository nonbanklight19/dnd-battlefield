import { useState, useRef, useMemo } from "react";
import iconNames from "../data/icon-names.json";

const PRESET_COLORS = [
  "#e05252", "#f59e0b", "#4ade80", "#3b82f6",
  "#7c6dec", "#ec4899", "#6b7280", "#e8e0d0",
];

type TokenSize = 1 | 2.4 | 3.5;

const TOKEN_SIZES: { value: TokenSize; label: string }[] = [
  { value: 1, label: "1×1" },
  { value: 2.4, label: "2×2" },
  { value: 3.5, label: "3×3" },
];

interface Props {
  sessionId: string;
  onAddEnemy: (data: { name: string; color: string; icon: string; customImage?: string; size: number; x: number; y: number }) => void;
  getViewCenter: (size?: number) => { x: number; y: number };
}

export function EnemyForm({ sessionId, onAddEnemy, getViewCenter }: Props) {
  const [name, setName] = useState("");
  const [iconSearch, setIconSearch] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [size, setSize] = useState<TokenSize>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return iconNames.slice(0, 50);
    const term = iconSearch.toLowerCase();
    return iconNames.filter((n) => n.includes(term)).slice(0, 50);
  }, [iconSearch]);

  const handleAdd = () => {
    if (!name.trim()) return;
    const iconUrl = customImage ?? (selectedIcon ? `/icons/${selectedIcon}.png` : `/icons/${iconNames[0]}.png`);
    const { x, y } = getViewCenter(size);
    onAddEnemy({
      name: name.trim(),
      color,
      icon: selectedIcon ?? iconNames[0],
      customImage: iconUrl,
      size,
      x,
      y,
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
      setSelectedIcon(null);
    }
  };

  const handleSelectIcon = (iconName: string) => {
    setSelectedIcon(iconName);
    setCustomImage(null);
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
      <input
        type="text"
        placeholder="Search icons..."
        value={iconSearch}
        onChange={(e) => setIconSearch(e.target.value)}
        className="w-full py-2 px-3 bg-bg-deep border border-border-default rounded-lg text-text-primary text-xs outline-none transition-all duration-150 focus:border-gold-muted focus:shadow-[0_0_0_3px_rgba(202,169,104,0.15)] mb-2"
      />
      <div className="flex gap-1.5 flex-wrap mb-2 max-h-[160px] overflow-y-auto">
        {filteredIcons.map((iconName) => (
          <div
            key={iconName}
            onClick={() => handleSelectIcon(iconName)}
            className="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
            title={iconName}
            style={{
              background: selectedIcon === iconName && !customImage ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
              border: selectedIcon === iconName && !customImage
                ? "2px solid var(--color-gold-bright, #caa968)"
                : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <img
              src={`/icons/${iconName}.png`}
              alt={iconName}
              className="w-5 h-5"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-text-muted cursor-pointer transition-all duration-150 hover:text-text-primary bg-bg-deep border border-border-default rounded-md px-2.5 py-1.5"
          style={customImage ? { borderColor: "var(--color-gold-bright, #caa968)", color: "var(--color-gold-bright, #caa968)" } : {}}
        >
          {customImage ? "Custom uploaded" : "Upload custom"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleIconUpload}
          className="hidden"
        />
        {(selectedIcon || customImage) && (
          <span className="text-xs text-text-muted truncate">
            {customImage ? "custom image" : selectedIcon}
          </span>
        )}
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

      <span className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-2">Enemy Size</span>
      <div className="flex gap-1.5 bg-bg-deep rounded-lg p-1.5 border border-border-default mb-4">
        {TOKEN_SIZES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSize(value)}
            className={`flex-1 py-1.5 px-2 text-xs rounded-md text-center cursor-pointer transition-all duration-150 border-none ${
              size === value
                ? "bg-gold-dim text-gold-bright"
                : "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            {label}
          </button>
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
