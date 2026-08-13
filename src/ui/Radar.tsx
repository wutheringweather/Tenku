import { useEffect, useRef } from 'react';
import type { Engine } from '@/three/Engine';

interface Props {
  engineRef: React.MutableRefObject<Engine | null>;
  count: number;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}

const SIZE = 108;
const R = SIZE / 2 - 6;

/**
 * A plan view of the garden. The wedge shows where the camera is looking,
 * so this is the only place you can see the whole world at once — the reticle
 * only ever shows what is in front of you.
 */
export function Radar({ engineRef, count, onSelect, reducedMotion }: Props) {
  const blipRefs = useRef<(SVGGElement | null)[]>([]);
  const wedgeRef = useRef<SVGGElement | null>(null);
  const camRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const engine = engineRef.current;
      if (!engine) return;

      const data = engine.getRadar();

      for (let i = 0; i < count; i++) {
        const g = blipRefs.current[i];
        const blip = data.blips[i];
        if (!g || !blip) continue;
        const x = SIZE / 2 + blip.x * R;
        const y = SIZE / 2 + blip.z * R;
        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        const dot = g.firstElementChild as SVGCircleElement | null;
        if (dot) {
          dot.setAttribute('r', blip.selected ? '3' : '1.7');
          dot.setAttribute('fill', blip.selected ? '#FF8A4C' : blip.color);
          dot.setAttribute('opacity', blip.selected ? '1' : '0.72');
        }
      }

      if (camRef.current) {
        camRef.current.setAttribute('cx', String(SIZE / 2 + data.camera.x * R));
        camRef.current.setAttribute('cy', String(SIZE / 2 + data.camera.z * R));
      }
      if (wedgeRef.current) {
        const deg = (data.heading * 180) / Math.PI;
        const cx = SIZE / 2 + data.camera.x * R;
        const cy = SIZE / 2 + data.camera.z * R;
        wedgeRef.current.setAttribute(
          'transform',
          `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(-deg).toFixed(1)})`,
        );
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, engineRef]);

  return (
    <div className="panel pointer-events-auto p-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Garden map">
        <defs>
          <radialGradient id="radar-bg">
            <stop offset="0%" stopColor="#18203C" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#070A16" stopOpacity="0.15" />
          </radialGradient>
          <linearGradient id="radar-wedge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 4} fill="url(#radar-bg)" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 4} fill="none" stroke="#C9A227" strokeWidth="0.6" opacity="0.28" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R * 0.62} fill="none" stroke="#C9A227" strokeWidth="0.5" opacity="0.14" strokeDasharray="1 3" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R * 0.3} fill="none" stroke="#C9A227" strokeWidth="0.5" opacity="0.14" strokeDasharray="1 3" />
        <line x1={SIZE / 2} y1="6" x2={SIZE / 2} y2={SIZE - 6} stroke="#F2EDE3" strokeWidth="0.4" opacity="0.07" />
        <line x1="6" y1={SIZE / 2} x2={SIZE - 6} y2={SIZE / 2} stroke="#F2EDE3" strokeWidth="0.4" opacity="0.07" />

        {/* hub */}
        <g>
          <circle cx={SIZE / 2} cy={SIZE / 2} r="3.6" fill="none" stroke="#C9A227" strokeWidth="0.8" opacity="0.8" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r="1.5"
            fill="#C9A227"
            className={reducedMotion ? '' : 'animate-pulseRing'}
          />
        </g>

        {/* view wedge */}
        <g ref={wedgeRef}>
          <path d="M 0 0 L -13 30 A 33 33 0 0 0 13 30 Z" fill="url(#radar-wedge)" />
          <line x1="0" y1="0" x2="0" y2="30" stroke="#C9A227" strokeWidth="0.5" opacity="0.4" />
        </g>

        {/* trees */}
        {Array.from({ length: count }, (_, i) => (
          <g
            key={i}
            ref={(el) => {
              blipRefs.current[i] = el;
            }}
            className="cursor-pointer"
            onClick={() => onSelect(i)}
          >
            <circle r="1.7" fill="#7CB668" />
            <circle r="6" fill="transparent" />
          </g>
        ))}

        {/* camera */}
        <circle ref={camRef} cx={SIZE / 2} cy={SIZE / 2} r="2" fill="#F2EDE3" opacity="0.9" />
      </svg>
    </div>
  );
}
