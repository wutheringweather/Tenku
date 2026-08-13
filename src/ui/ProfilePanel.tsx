import { useState } from 'react';
import type { ProfileBundle } from '@/three/types';
import { languageBreakdown } from '@/lib/derive';
import { languageHex } from '@/lib/languages';
import { formatCount } from '@/lib/math';
import { ExternalIcon } from './Icons';

interface Props {
  bundle: ProfileBundle;
  overflow: number;
  onExit: () => void;
}

export function ProfilePanel({ bundle, overflow, onExit }: Props) {
  const [open, setOpen] = useState(true);
  const { profile } = bundle;
  const langs = languageBreakdown(bundle, 4);
  const activeDays = bundle.activity.filter((d) => d.count > 0).length;
  const busiest = bundle.activity.reduce((a, b) => (b.count > a.count ? b : a), bundle.activity[0]);

  return (
    <div className="panel pointer-events-auto w-[min(320px,calc(100vw-2rem))] animate-riseIn">
      {/* header */}
      <div className="flex items-start gap-3 p-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[8px] border border-brass/30 bg-slate1">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-full w-full object-cover opacity-90"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center font-display text-lg text-brass">
              {profile.login.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] leading-tight text-bone">
            {profile.name || profile.login}
          </div>
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-mono text-[10px] text-ash transition-colors hover:text-brass"
          >
            @{profile.login}
            <ExternalIcon className="text-[10px]" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-[10px] uppercase tracking-wide2 text-ash/60 transition-colors hover:text-brass"
        >
          {open ? 'Less' : 'More'}
        </button>
      </div>

      {bundle.demo && (
        <div className="mx-3 mb-3 border-l-2 border-brass/60 bg-brass/[0.06] px-3 py-2 font-mono text-[10px] leading-relaxed text-brass">
          Sample world, generated locally. Nothing here is real.
        </div>
      )}

      {open && (
        <div className="animate-driftIn">
          <div className="mx-3 h-px bg-bone/[0.07]" />

          {/* counts */}
          <div className="grid grid-cols-3 divide-x divide-bone/[0.07] px-3 py-3">
            {[
              ['Repos', formatCount(profile.publicRepos)],
              ['Followers', formatCount(profile.followers)],
              ['Following', formatCount(profile.following)],
            ].map(([label, value], i) => (
              <div key={label} className={i === 0 ? 'pr-3' : 'px-3'}>
                <div className="font-mono text-[9px] uppercase tracking-wide2 text-ash/60">
                  {label}
                </div>
                <div className="font-display text-lg leading-tight text-bone">{value}</div>
              </div>
            ))}
          </div>

          {/* languages */}
          {langs.length > 0 && (
            <>
              <div className="mx-3 h-px bg-bone/[0.07]" />
              <div className="p-3">
                <div className="eyebrow mb-2">Languages by repo count</div>
                <div className="mb-2 flex h-[3px] w-full overflow-hidden">
                  {langs.map((l) => (
                    <div
                      key={l.language}
                      style={{ width: `${l.share * 100}%`, background: languageHex(l.language) }}
                      className="h-full opacity-80"
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {langs.map((l) => (
                    <span key={l.language} className="flex items-center gap-1.5 font-mono text-[10px] text-ash">
                      <span
                        className="h-[6px] w-[6px]"
                        style={{ background: languageHex(l.language) }}
                      />
                      {l.language}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* activity */}
          <div className="mx-3 h-px bg-bone/[0.07]" />
          <div className="p-3">
            <div className="eyebrow mb-2">Public activity, last 90 days</div>
            <div className="flex items-end gap-[1.5px]">
              {bundle.activity.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date} — ${d.count} event${d.count === 1 ? '' : 's'}`}
                  className="min-w-0 flex-1 bg-brass transition-opacity"
                  style={{
                    height: `${4 + d.intensity * 22}px`,
                    opacity: 0.18 + d.intensity * 0.82,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 font-mono text-[10px] text-ash/70">
              {activeDays} active days · busiest {busiest?.count ?? 0} events
            </div>
          </div>

          {/* how to read the world */}
          <div className="mx-3 h-px bg-bone/[0.07]" />
          <div className="p-3">
            <div className="eyebrow mb-2">Reading the world</div>
            <dl className="space-y-1 font-mono text-[10px] leading-relaxed text-ash">
              {[
                ['Tree height', 'stars'],
                ['Canopy width', 'forks'],
                ['Altitude', 'how recently it was pushed'],
                ['Colour', 'primary language'],
                ['Sap flow', 'how alive the repo is'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-[76px] shrink-0 text-brass/70">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {overflow > 0 && (
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-ash/70">
                {overflow} more {overflow === 1 ? 'repository is' : 'repositories are'} folded
                into the centre. The garden shows the top 22 by stars.
              </p>
            )}
          </div>

          <div className="mx-3 h-px bg-bone/[0.07]" />
          <div className="p-3">
            <button type="button" onClick={onExit} className="btn w-full">
              Build another world
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
