import { useEffect, useRef, useState } from 'react';
import { site } from '@/config/site';
import { ArrowIcon, KeyIcon, XIcon } from './Icons';
import { getToken, setToken } from '@/lib/github';

interface Props {
  onEnter: (username: string) => void;
  onDemo: () => void;
  busy: boolean;
  error: { message: string; hint?: string } | null;
  onDismissError: () => void;
}

export function Portal({ onEnter, onDemo, busy, error, onDismissError }: Props) {
  const [value, setValue] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [token, setTokenValue] = useState(() => getToken());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 900);
    return () => clearTimeout(t);
  }, []);

  const submit = () => {
    if (busy || !value.trim()) return;
    onEnter(value.trim());
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col">
      {/* Top right social link */}
      {site.links.x && (
        <div className="animate-riseIn pointer-events-auto absolute right-4 top-4 z-40 sm:right-6 sm:top-6" style={{ animationDelay: '100ms' }}>
          <a
            href={site.links.x}
            target="_blank"
            rel="noreferrer noopener"
            className="panel flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] text-ash/80 transition-all duration-300 hover:border-brass/40 hover:text-brass"
            title="Follow on X (@tenkugithub)"
          >
            <XIcon className="text-[13px] text-ash/70 transition-colors group-hover:text-brass" />
            <span className="tracking-wide">@tenkugithub</span>
          </a>
        </div>
      )}

      {/* A downward wash so the type always sits on something darker than the sky. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/85 via-void/35 to-void/80" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="pointer-events-auto w-full max-w-[540px]">
          <div className="animate-riseIn" style={{ animationDelay: '120ms' }}>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-brass/50" />
              <span className="eyebrow">A world built from public commits</span>
            </div>
          </div>

          <h1
            className="animate-riseIn font-display text-[clamp(3.2rem,13vw,7rem)] font-normal leading-[0.86] tracking-[-0.02em] text-bone"
            style={{ animationDelay: '220ms' }}
          >
            {site.wordmark}
          </h1>

          <p
            className="animate-riseIn mt-5 max-w-[38ch] font-ui text-[15px] leading-relaxed text-ash"
            style={{ animationDelay: '340ms' }}
          >
            {site.blurb}
          </p>

          {/* input */}
          <div className="animate-riseIn mt-10" style={{ animationDelay: '440ms' }}>
            <label htmlFor="username" className="eyebrow mb-3 block">
              GitHub username or profile link
            </label>
            <div className="group flex items-stretch gap-0 border-b border-bone/20 transition-colors duration-500 focus-within:border-brass/80">
              <span className="grid place-items-center pr-3 font-mono text-lg text-brass/50">@</span>
              <input
                ref={inputRef}
                id="username"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) onDismissError();
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="torvalds or github.com/torvalds"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={busy}
                className="w-full bg-transparent py-3 font-ui text-xl text-bone placeholder:text-bone/22 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy || !value.trim()}
                className="btn btn-primary my-2 shrink-0 px-5"
              >
                {busy ? 'Building' : 'Enter'}
                {!busy && <ArrowIcon className="text-[13px]" />}
              </button>
            </div>

            {/* error */}
            {error && (
              <div
                role="alert"
                className="mt-4 animate-driftIn border-l-2 border-ember/70 bg-ember/[0.06] px-4 py-3"
              >
                <p className="font-ui text-sm text-bone">{error.message}</p>
                {error.hint && <p className="mt-1 font-mono text-[11px] text-ash">{error.hint}</p>}
              </div>
            )}

            {/* seeds */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-1">Or start here</span>
              {site.seeds.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => {
                    setValue(seed);
                    onEnter(seed);
                  }}
                  disabled={busy}
                  className="chip disabled:opacity-40"
                >
                  {seed}
                </button>
              ))}
              <button type="button" onClick={onDemo} disabled={busy} className="chip disabled:opacity-40">
                demo world
              </button>
            </div>
          </div>

          {/* token */}
          <div className="animate-riseIn mt-8" style={{ animationDelay: '560ms' }}>
            {!showToken ? (
              <button
                type="button"
                onClick={() => setShowToken(true)}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide2 text-ash/70 transition-colors hover:text-brass"
              >
                <KeyIcon className="text-[12px]" />
                Add a token to lift the rate limit
              </button>
            ) : (
              <div className="panel-quiet p-4">
                <label htmlFor="token" className="eyebrow mb-2 block">
                  Personal access token
                </label>
                <input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => {
                    setTokenValue(e.target.value);
                    setToken(e.target.value);
                  }}
                  placeholder="ghp_…"
                  autoComplete="off"
                  className="w-full border-b border-bone/15 bg-transparent py-2 font-mono text-xs text-bone placeholder:text-bone/20 focus:border-brass/60 focus:outline-none"
                />
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-ash/80">
                  Stays in this browser. Never sent anywhere except GitHub. No scopes needed —
                  a token with zero permissions still raises the limit to 5,000 requests an hour.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* bottom rail */}
      <div className="animate-riseIn relative px-6 pb-6" style={{ animationDelay: '700ms' }}>
        <div className="rule mb-3" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-wide2 text-ash/55">
          <span>{site.meta.build}</span>
          <span className="hidden sm:inline">{site.meta.engine}</span>
          <span className="hidden md:inline">{site.meta.source}</span>
          {site.links.x && (
            <a
              href={site.links.x}
              target="_blank"
              rel="noreferrer noopener"
              className="pointer-events-auto inline-flex items-center gap-1.5 text-ash/70 transition-colors hover:text-brass"
            >
              <XIcon className="text-[11px]" />
              <span>@tenkugithub</span>
            </a>
          )}
          <span className="ml-auto hidden text-brass/60 sm:inline">
            Drag to look · Scroll to close in
          </span>
        </div>
      </div>
    </div>
  );
}
