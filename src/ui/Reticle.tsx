import { useEffect, useRef, useState } from 'react';
import type { Engine } from '@/three/Engine';
import type { CameraMode } from '@/three/types';

interface Props {
  engineRef: React.MutableRefObject<Engine | null>;
  mode: CameraMode;
  active: boolean;
  reducedMotion: boolean;
}

const MAX_MARKERS = 24;
/** Half-width of the arc, in radians, over which a marker is drawn at all. */
const ARC = Math.PI * 0.62;
/** Within this many radians of dead ahead, the island name is written out. */
const LOCK = 0.13;

/**
 * The instrument this whole interface is built around.
 *
 * A thin brass ring sits at the centre of the view with a tick for every island,
 * placed at its true bearing. Turn the camera and the ticks sweep like a compass
 * rose. Bring one to the top of the ring and its name is written beneath it —
 * which is also how you find a repository you cannot currently see.
 *
 * Updated by its own rAF loop reading directly from the engine, so the whole
 * thing costs zero React renders per frame.
 */
export function Reticle({ engineRef, mode, active, reducedMotion }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const markerRefs = useRef<(SVGGElement | null)[]>([]);
  const lockRef = useRef<SVGTextElement | null>(null);
  const lockRuleRef = useRef<SVGLineElement | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;
  const R = Math.max(120, Math.min(size.w, size.h) * (size.w < 640 ? 0.30 : 0.335));

  useEffect(() => {
    if (!active) return;
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const engine = engineRef.current;
      if (!engine) return;

      const bearings = engine.getBearings();
      let best: { name: string; angle: number; color: string } | null = null;

      for (let i = 0; i < MAX_MARKERS; i++) {
        const g = markerRefs.current[i];
        if (!g) continue;
        const b = bearings[i];

        if (!b || Math.abs(b.angle) > ARC) {
          g.style.opacity = '0';
          continue;
        }

        const x = cx + Math.sin(b.angle) * R;
        const y = cy - Math.cos(b.angle) * R;
        const deg = (b.angle * 180) / Math.PI;

        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`);

        // Fade with bearing offset so the edges of the arc dissolve.
        const edge = 1 - Math.abs(b.angle) / ARC;
        const centred = 1 - Math.min(1, Math.abs(b.angle) / 0.5);
        const near = 1 - Math.min(1, b.distance / 320);
        const op = (0.20 + centred * 0.65 + near * 0.15) * Math.pow(edge, 0.6);
        g.style.opacity = String(b.selected ? Math.min(1, op + 0.4) : op);

        const tick = g.firstElementChild as SVGLineElement | null;
        if (tick) {
          tick.setAttribute('stroke', b.selected ? '#FF8A4C' : b.color);
          tick.setAttribute('y2', String(b.selected ? 15 : 6 + centred * 6));
        }

        if (Math.abs(b.angle) < LOCK && (!best || Math.abs(b.angle) < Math.abs(best.angle))) {
          best = { name: b.name, angle: b.angle, color: b.color };
        }
      }

      const lock = lockRef.current;
      const rule = lockRuleRef.current;
      if (lock && rule) {
        if (best) {
          lock.textContent = best.name;
          lock.setAttribute('x', String(cx + Math.sin(best.angle) * R));
          lock.style.opacity = String(1 - Math.abs(best.angle) / LOCK);
          lock.setAttribute('fill', best.color);
          rule.style.opacity = String(0.5 * (1 - Math.abs(best.angle) / LOCK));
        } else {
          lock.style.opacity = '0';
          rule.style.opacity = '0';
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, cx, cy, R, engineRef]);

  if (!active) return null;

  // Degree ticks every 10°, taller every 30°.
  const graduations: JSX.Element[] = [];
  for (let d = -35; d <= 35; d++) {
    const a = (d * 10 * Math.PI) / 180;
    if (Math.abs(a) > ARC) continue;
    const major = d % 3 === 0;
    const len = major ? 7 : 3.5;
    const x1 = cx + Math.sin(a) * (R - len);
    const y1 = cy - Math.cos(a) * (R - len);
    const x2 = cx + Math.sin(a) * R;
    const y2 = cy - Math.cos(a) * R;
    graduations.push(
      <line
        key={d}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#C9A227"
        strokeWidth={major ? 0.9 : 0.6}
        opacity={major ? 0.30 : 0.16}
      />,
    );
  }

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none fixed inset-0 z-20 hidden sm:block"
      width={size.w}
      height={size.h}
      aria-hidden
    >
      <defs>
        <radialGradient id="arc-ring-fade">
          <stop offset="55%" stopColor="#C9A227" stopOpacity="0" />
          <stop offset="100%" stopColor="#C9A227" stopOpacity="0.5" />
        </radialGradient>
      </defs>

      {/* the ring itself */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="#C9A227"
        strokeWidth="0.75"
        opacity="0.16"
        strokeDasharray="1 3"
      />
      <circle
        cx={cx}
        cy={cy}
        r={R + 9}
        fill="none"
        stroke="#F2EDE3"
        strokeWidth="0.5"
        opacity="0.05"
      />

      {graduations}

      {/* dead-ahead index mark */}
      <path
        d={`M ${cx} ${cy - R - 14} l 4.5 7 h -9 Z`}
        fill="#C9A227"
        opacity="0.55"
      />

      {/* island bearing markers */}
      {Array.from({ length: MAX_MARKERS }, (_, i) => (
        <g
          key={i}
          ref={(el) => {
            markerRefs.current[i] = el;
          }}
          style={{ opacity: 0, transition: reducedMotion ? 'none' : 'opacity 120ms linear' }}
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="0" cy="-2.5" r="1.4" fill="#F2EDE3" opacity="0.75" />
        </g>
      ))}

      {/* the name of whatever is dead ahead */}
      <line
        ref={lockRuleRef}
        x1={cx - 44}
        y1={cy - R + 22}
        x2={cx + 44}
        y2={cy - R + 22}
        stroke="#C9A227"
        strokeWidth="0.6"
        style={{ opacity: 0 }}
      />
      <text
        ref={lockRef}
        x={cx}
        y={cy - R + 38}
        textAnchor="middle"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="10"
        letterSpacing="0.22em"
        fill="#C9A227"
        style={{ opacity: 0, textTransform: 'uppercase' }}
      />

      {/* flight-mode crosshair */}
      {mode === 'flight' && (
        <g opacity="0.5">
          <circle cx={cx} cy={cy} r="9" fill="none" stroke="#F2EDE3" strokeWidth="0.7" />
          <line x1={cx - 17} y1={cy} x2={cx - 12} y2={cy} stroke="#F2EDE3" strokeWidth="0.9" />
          <line x1={cx + 12} y1={cy} x2={cx + 17} y2={cy} stroke="#F2EDE3" strokeWidth="0.9" />
          <line x1={cx} y1={cy - 17} x2={cx} y2={cy - 12} stroke="#F2EDE3" strokeWidth="0.9" />
          <line x1={cx} y1={cy + 12} x2={cx} y2={cy + 17} stroke="#F2EDE3" strokeWidth="0.9" />
          <circle cx={cx} cy={cy} r="1.2" fill="#FF8A4C" />
        </g>
      )}
    </svg>
  );
}
