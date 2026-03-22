import { useState, useEffect } from "react";
import type { HeroType } from "../types.js";

import warriorSvg from "../assets/heroes/warrior.svg";
import wizardSvg from "../assets/heroes/wizard.svg";
import rogueSvg from "../assets/heroes/rogue.svg";
import dwarfSvg from "../assets/heroes/dwarf.svg";
import tritonSvg from "../assets/heroes/triton.svg";

const HERO_SVGS: Record<HeroType, string> = {
  warrior: warriorSvg,
  wizard: wizardSvg,
  rogue: rogueSvg,
  dwarf: dwarfSvg,
  triton: tritonSvg,
};

export function useHeroImages() {
  const [images, setImages] = useState<Record<HeroType, HTMLImageElement> | null>(null);

  useEffect(() => {
    const entries = Object.entries(HERO_SVGS) as [HeroType, string][];
    const loaded: Partial<Record<HeroType, HTMLImageElement>> = {};
    let cancelled = false;

    Promise.all(
      entries.map(
        ([type, src]) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
              loaded[type] = img;
              resolve();
            };
            img.onerror = () => resolve();
          })
      )
    ).then(() => {
      if (!cancelled) {
        setImages(loaded as Record<HeroType, HTMLImageElement>);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return images;
}
