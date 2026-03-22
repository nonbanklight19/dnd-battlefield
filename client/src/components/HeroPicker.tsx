import type { HeroType, Token } from "../types.js";

import warriorSvg from "../assets/heroes/warrior.svg";
import wizardSvg from "../assets/heroes/wizard.svg";
import rogueSvg from "../assets/heroes/rogue.svg";
import dwarfSvg from "../assets/heroes/dwarf.svg";
import tritonSvg from "../assets/heroes/triton.svg";

const HEROES: { type: HeroType; label: string; svg: string; color: string }[] = [
  { type: "warrior", label: "Warrior", svg: warriorSvg, color: "#e05252" },
  { type: "wizard", label: "Wizard", svg: wizardSvg, color: "#3b82f6" },
  { type: "rogue", label: "Rogue", svg: rogueSvg, color: "#7c6dec" },
  { type: "dwarf", label: "Dwarf", svg: dwarfSvg, color: "#f59e0b" },
  { type: "triton", label: "Triton", svg: tritonSvg, color: "#06b6d4" },
];

interface Props {
  tokens: Token[];
  onAddHero: (data: { heroType: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
  getViewCenter: () => { x: number; y: number };
}

export function HeroPicker({ tokens, onAddHero, onRemoveToken, getViewCenter }: Props) {
  const placedHeroes = tokens.filter((t) => t.kind === "hero");

  const isPlaced = (type: HeroType) =>
    placedHeroes.some((t) => t.kind === "hero" && t.heroType === type);

  const getPlacedTokenId = (type: HeroType) =>
    placedHeroes.find((t) => t.kind === "hero" && t.heroType === type)?.id;

  const handleClick = (hero: typeof HEROES[0]) => {
    if (isPlaced(hero.type)) {
      const id = getPlacedTokenId(hero.type);
      if (id) onRemoveToken(id);
    } else {
      const { x, y } = getViewCenter();
      onAddHero({ heroType: hero.type, x, y });
    }
  };

  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {HEROES.map((hero) => {
        const placed = isPlaced(hero.type);
        return (
          <div
            key={hero.type}
            onClick={() => handleClick(hero)}
            className="flex flex-col items-center cursor-pointer p-2 rounded-lg transition-all duration-150"
            style={{
              border: `2px solid ${placed ? hero.color : `${hero.color}4D`}`,
              background: placed ? `${hero.color}1A` : "transparent",
              opacity: placed ? 0.5 : 1,
            }}
          >
            <img
              src={hero.svg}
              alt={hero.label}
              className="w-10 h-[52px] object-contain"
            />
            <span
              className="text-[9px] font-medium mt-1"
              style={{ color: hero.color }}
            >
              {hero.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
