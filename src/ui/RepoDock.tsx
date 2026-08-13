import { useEffect, useRef } from 'react';
import type { IslandSpec } from '@/three/types';
import { languageHex } from '@/lib/languages';
import { formatCount } from '@/lib/math';

interface Props {
  islands: IslandSpec[];
  selected: number | null;
  hovered: number | null;
  onSelect: (index: number) => void;
}

/**
 * Every tree, in rank order, as a strip along the bottom of the screen.
 * The tick above each entry is the same height as its stem and canopy, so the
 * dock is a flattened elevation profile of the garden.
 */
export function RepoDock({ islands, selected, hovered, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (selected === null) return;
    itemRefs.current[selected]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selected]);

  const maxSpire = Math.max(1, ...islands.map((i) => i.spire));

  return (
    <div className="pointer-events-auto w-full">
      <div className="hairline-top" />
      <div
        ref={scrollRef}
        className="no-scrollbar flex items-end gap-0 overflow-x-auto bg-gradient-to-t from-void/85 to-transparent px-3 pb-3 pt-4"
      >
        {islands.map((island) => {
          const isSelected = selected === island.index;
          const isHovered = hovered === island.index;
          const color = languageHex(island.repo.language);
          const h = 8 + (island.spire / maxSpire) * 26;

          return (
            <button
              key={island.repo.id}
              ref={(el) => {
                itemRefs.current[island.index] = el;
              }}
              type="button"
              onClick={() => onSelect(island.index)}
              aria-pressed={isSelected}
              className={`group flex shrink-0 flex-col items-center gap-1.5 px-2.5 pb-1 transition-opacity duration-300 ${
                isSelected ? 'opacity-100' : isHovered ? 'opacity-90' : 'opacity-45 hover:opacity-100'
              }`}
            >
              {/* elevation tick */}
              <span
                className="w-[2px] origin-bottom transition-all duration-500 ease-instrument"
                style={{
                  height: `${h}px`,
                  background: color,
                  boxShadow: isSelected ? `0 0 12px ${color}` : 'none',
                  transform: isSelected ? 'scaleY(1.35)' : 'scaleY(1)',
                }}
              />
              <span
                className={`max-w-[92px] truncate font-ui text-[11px] font-medium transition-colors ${
                  isSelected ? 'text-bone' : 'text-ash group-hover:text-bone'
                }`}
              >
                {island.repo.name}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-ash/60">
                {formatCount(island.repo.stars)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
