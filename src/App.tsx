import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '@/three/Engine';
import type { CameraMode, Phase, WorldSpec } from '@/three/types';
import { deriveWorld } from '@/lib/derive';
import { GitHubError, fetchProfileBundle } from '@/lib/github';
import { demoBundle } from '@/lib/mock';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { site } from '@/config/site';

import { Portal } from '@/ui/Portal';
import { Materialize } from '@/ui/Materialize';
import { Reticle } from '@/ui/Reticle';
import { Radar } from '@/ui/Radar';
import { RepoDock } from '@/ui/RepoDock';
import { RepoDrawer } from '@/ui/RepoDrawer';
import { ProfilePanel } from '@/ui/ProfilePanel';
import { ControlHints, ModeSwitch, Telemetry, type Quality } from '@/ui/Hud';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('portal');
  const [spec, setSpec] = useState<WorldSpec | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);

  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [mode, setMode] = useState<CameraMode>('orbit');
  const [locked, setLocked] = useState(false);
  const [fps, setFps] = useState(60);
  const [altitude, setAltitude] = useState(0);
  const [quality, setQuality] = useState<Quality>('high');

  /* ---------------- engine lifecycle ---------------- */

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const engine = new Engine(
      mount,
      {
        onHover: setHovered,
        onSelect: setSelected,
        onStats: (f, m, alt) => {
          setFps(f);
          setAltitude(alt);
          setMode(m);
        },
        onSequenceStage: (s, p) => {
          setStage(s);
          // The fetch owns 0–70%, the build owns 70–100%.
          setProgress(0.7 + p * 0.3);
        },
        onReady: () => setPhase('world'),
      },
      { reducedMotion },
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // The engine is built once. Reduced motion is pushed in below rather than
    // rebuilding the whole scene when the media query flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    const onLockChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  /* ---------------- entering a world ---------------- */

  const enterWorld = useCallback((worldSpec: WorldSpec, name: string) => {
    setSpec(worldSpec);
    setUsername(name);
    setSelected(null);
    setHovered(null);
    setPhase('materialize');
    engineRef.current?.build(worldSpec);
  }, []);

  const handleEnter = useCallback(
    async (name: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setError(null);
      setStage('');
      setProgress(0);

      try {
        const bundle = await fetchProfileBundle(name, controller.signal, (s, p) => {
          setStage(s);
          setProgress(p);
        });

        if (bundle.repos.length === 0) {
          setError({
            message: `@${bundle.profile.login} has no public repositories yet.`,
            hint: 'There is nothing to build a world from. Try another username.',
          });
          setBusy(false);
          return;
        }

        enterWorld(deriveWorld(bundle), bundle.profile.login);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (err instanceof GitHubError) setError({ message: err.message, hint: err.hint });
        else setError({ message: 'Something went wrong building that world.', hint: 'Try again.' });
      } finally {
        setBusy(false);
      }
    },
    [enterWorld],
  );

  const handleDemo = useCallback(() => {
    const bundle = demoBundle();
    setError(null);
    enterWorld(deriveWorld(bundle), bundle.profile.login);
  }, [enterWorld]);

  const handleExit = useCallback(() => {
    abortRef.current?.abort();
    setPhase('portal');
    setSpec(null);
    setSelected(null);
    setStage('');
    setProgress(0);
    engineRef.current?.setMode('orbit');
    engineRef.current?.clearSelection();
  }, []);

  /* ---------------- selection ---------------- */

  const selectIsland = useCallback((index: number) => {
    engineRef.current?.select(index);
  }, []);

  const stepIsland = useCallback(
    (delta: number) => {
      if (!spec || selected === null) return;
      const next = (selected + delta + spec.islands.length) % spec.islands.length;
      engineRef.current?.select(next);
    },
    [selected, spec],
  );

  const clearSelection = useCallback(() => {
    engineRef.current?.clearSelection();
  }, []);

  useEffect(() => {
    if (phase !== 'world') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' && selected === null) clearSelection();
      if (e.key.toLowerCase() === 'f') {
        const next: CameraMode = mode === 'flight' ? 'orbit' : 'flight';
        engineRef.current?.setMode(next);
        setMode(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selected, mode, clearSelection]);

  const changeMode = useCallback((next: CameraMode) => {
    engineRef.current?.setMode(next);
    setMode(next);
  }, []);

  const selectedIsland = spec && selected !== null ? spec.islands[selected] : null;

  /* ---------------- render ---------------- */

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      {/* the scene */}
      <div ref={mountRef} className="absolute inset-0" aria-hidden />

      {/* signature instrument */}
      <Reticle
        engineRef={engineRef}
        mode={mode}
        active={phase === 'world'}
        reducedMotion={reducedMotion}
      />

      {/* entry */}
      {phase === 'portal' && (
        <Portal
          onEnter={handleEnter}
          onDemo={handleDemo}
          busy={busy}
          error={error}
          onDismissError={() => setError(null)}
        />
      )}

      {/* loading */}
      {phase !== 'portal' && (
        <Materialize
          stage={stage}
          progress={progress}
          username={username}
          visible={phase === 'materialize'}
        />
      )}

      {/* world HUD */}
      {phase === 'world' && spec && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {/* top row */}
          <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
            <div className="flex max-h-[calc(100vh-9rem)] flex-col overflow-y-auto lg:max-h-[calc(100vh-13rem)]">
              <ProfilePanel bundle={spec.bundle} overflow={spec.overflow} onExit={handleExit} />
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <ModeSwitch mode={mode} onChange={changeMode} />
                <Telemetry
                  fps={fps}
                  altitude={altitude}
                  islands={spec.islands.length}
                  quality={quality}
                  onQuality={setQuality}
                />
              </div>

              <div className="hidden md:block">
                <Radar
                  engineRef={engineRef}
                  count={spec.islands.length}
                  onSelect={selectIsland}
                  reducedMotion={reducedMotion}
                />
              </div>

              {selectedIsland && (
                <div className="hidden max-h-[calc(100vh-16rem)] overflow-y-auto md:block">
                  <RepoDrawer
                    island={selectedIsland}
                    onClose={clearSelection}
                    onStep={stepIsland}
                    total={spec.islands.length}
                  />
                </div>
              )}
            </div>
          </div>

          {/* bottom overlay — pinned to the true viewport bottom with `absolute`
              rather than flexed after the top row, so a tall ProfilePanel or
              desktop RepoDrawer can never push it below the fold. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col">
            {/* bottom row */}
            <div className="flex items-end justify-between gap-4 px-4 pb-1">
              <ControlHints mode={mode} locked={locked} />
              <div className="hidden font-mono text-[10px] uppercase tracking-instrument text-brass/40 lg:block">
                {site.name}
              </div>
            </div>

            {/* mobile drawer */}
            {selectedIsland && (
              <div className="pointer-events-auto max-h-[52vh] overflow-y-auto px-3 pb-2 md:hidden">
                <RepoDrawer
                  island={selectedIsland}
                  onClose={clearSelection}
                  onStep={stepIsland}
                  total={spec.islands.length}
                />
              </div>
            )}

            <RepoDock
              islands={spec.islands}
              selected={selected}
              hovered={hovered}
              onSelect={selectIsland}
            />
          </div>
        </div>
      )}
    </div>
  );
}
