import { useEffect, useState } from 'react';
import type { CameraMode } from '@/three/types';
import { FlightIcon, OrbitIcon, SettingsIcon } from './Icons';

export type Quality = 'high' | 'balanced' | 'low';

interface ModeSwitchProps {
  mode: CameraMode;
  onChange: (mode: CameraMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div
      className="panel pointer-events-auto flex items-stretch p-0.5"
      role="radiogroup"
      aria-label="Camera mode"
    >
      {(
        [
          ['orbit', 'Orbit', <OrbitIcon key="o" className="text-[13px]" />],
          ['flight', 'Flight', <FlightIcon key="f" className="text-[13px]" />],
        ] as const
      ).map(([value, label, icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide2 transition-all duration-300 ease-instrument ${
            mode === value
              ? 'bg-brass/15 text-brass'
              : 'text-ash/70 hover:bg-bone/[0.04] hover:text-bone'
          }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface HintsProps {
  mode: CameraMode;
  locked: boolean;
}

const ORBIT_HINTS: [string, string][] = [
  ['Drag', 'Look around'],
  ['Scroll', 'Move closer'],
  ['Click', 'Visit a tree'],
  ['Esc', 'Back to the whole world'],
];

const FLIGHT_HINTS: [string, string][] = [
  ['W A S D', 'Fly'],
  ['Space / C', 'Up and down'],
  ['Shift', 'Faster'],
  ['Click', 'Visit what is centred'],
];

export function ControlHints({ mode, locked }: HintsProps) {
  const hints = mode === 'flight' ? FLIGHT_HINTS : ORBIT_HINTS;

  return (
    <div className="pointer-events-none hidden select-none lg:block">
      {mode === 'flight' && !locked && (
        <div className="mb-2 animate-pulseRing font-mono text-[10px] uppercase tracking-wide2 text-brass">
          Click the view to take the controls
        </div>
      )}
      <dl className="space-y-1">
        {hints.map(([key, action]) => (
          <div key={key} className="flex items-baseline gap-3">
            <dt className="w-[62px] shrink-0 text-right font-mono text-[10px] uppercase tracking-wide2 text-brass/60">
              {key}
            </dt>
            <dd className="font-ui text-[11px] text-ash/70">{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface TelemetryProps {
  fps: number;
  altitude: number;
  islands: number;
  quality: Quality;
  onQuality: (q: Quality) => void;
}

export function Telemetry({ fps, altitude, islands, quality, onQuality }: TelemetryProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="panel flex items-center gap-3 px-3 py-1.5 transition-colors hover:border-brass/40"
      >
        <span className="font-mono text-[10px] tabular-nums text-ash/70">
          <span className={fps < 30 ? 'text-ember' : 'text-verdigris'}>{fps}</span> fps
        </span>
        <span className="hidden font-mono text-[10px] tabular-nums text-ash/70 sm:inline">
          alt {altitude >= 0 ? '+' : ''}
          {altitude.toFixed(0)}
        </span>
        <SettingsIcon className="text-[13px] text-ash/70" />
      </button>

      {open && (
        // z-30: `.panel`'s backdrop-blur gives this its own stacking context with
        // z-index:auto, which falls back to DOM order against the Radar panel
        // below it — Radar comes later in the tree and would paint over this
        // without an explicit z-index to win the comparison outright.
        <div className="panel absolute right-0 top-[calc(100%+6px)] z-30 w-[210px] animate-driftIn p-3">
          <div className="eyebrow mb-2">Render quality</div>
          <div className="mb-3 flex gap-1">
            {(['high', 'balanced', 'low'] as Quality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuality(q)}
                className={`flex-1 rounded-[6px] border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wide2 transition-colors ${
                  quality === q
                    ? 'border-brass/60 bg-brass/12 text-brass'
                    : 'border-bone/10 text-ash/70 hover:border-brass/30 hover:text-bone'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-ash/70">
            Low turns off bloom and the film grade. Use it if the frame rate drops below 30.
          </p>
          <div className="h-px bg-bone/[0.07]" />
          <dl className="mt-3 space-y-1 font-mono text-[10px] text-ash">
            <div className="flex justify-between">
              <dt className="text-ash/55">Trees</dt>
              <dd className="tabular-nums">{islands}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash/55">Frame rate</dt>
              <dd className="tabular-nums">{fps} fps</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash/55">Altitude</dt>
              <dd className="tabular-nums">{altitude.toFixed(1)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
