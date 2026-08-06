import { useEffect, useRef, useState } from 'react';

interface Props {
  stage: string;
  progress: number;
  username: string;
  visible: boolean;
}

/**
 * Shown while the world assembles. The log is real: each line is written when
 * the corresponding stage actually completes, so a slow network reads as a slow
 * log rather than a fake progress bar.
 */
export function Materialize({ stage, progress, username, visible }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const lastStage = useRef('');

  useEffect(() => {
    if (!stage || stage === lastStage.current) return;
    lastStage.current = stage;
    setLines((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
  }, [stage]);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => {
        setLines([]);
        lastStage.current = '';
      }, 700);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-30 transition-opacity duration-[900ms] ease-instrument ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/25 to-void/70" />

      <div className="relative flex h-full flex-col justify-end px-6 pb-10 sm:px-10 sm:pb-12">
        <div className="max-w-[520px]">
          <div className="eyebrow mb-3">Building world</div>

          <div className="mb-6 font-display text-[clamp(2rem,7vw,3.4rem)] leading-none tracking-tight text-bone">
            @{username}
          </div>

          {/* build log */}
          <div className="mb-6 space-y-1 font-mono text-[11px] text-ash">
            {lines.map((line, i) => (
              <div
                key={line}
                className="animate-driftIn flex items-baseline gap-3"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="text-brass/60">{String(i + 1).padStart(2, '0')}</span>
                <span className={i === lines.length - 1 ? 'text-bone' : ''}>{line}</span>
                {i < lines.length - 1 && <span className="ml-auto text-verdigris/70">done</span>}
              </div>
            ))}
          </div>

          {/* progress */}
          <div className="flex items-center gap-4">
            <div className="relative h-px flex-1 bg-bone/10">
              <div
                className="absolute inset-y-0 left-0 bg-brass transition-[width] duration-500 ease-instrument"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute top-1/2 h-[7px] w-[7px] -translate-y-1/2 rotate-45 bg-brass transition-[left] duration-500 ease-instrument"
                style={{ left: `calc(${pct}% - 3.5px)` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[11px] tabular-nums text-brass">
              {String(pct).padStart(3, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
