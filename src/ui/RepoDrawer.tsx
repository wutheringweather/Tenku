import { useEffect } from 'react';
import type { IslandSpec } from '@/three/types';
import { languageHex } from '@/lib/languages';
import { formatCount, relativeTime } from '@/lib/math';
import { CloseIcon, ExternalIcon, ForkIcon, IssueIcon, StarIcon } from './Icons';

interface Props {
  island: IslandSpec | null;
  onClose: () => void;
  onStep: (delta: number) => void;
  total: number;
}

export function RepoDrawer({ island, onClose, onStep, total }: Props) {
  useEffect(() => {
    if (!island) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '[') onStep(-1);
      if (e.key === ']') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [island, onClose, onStep]);

  if (!island) return null;

  const { repo } = island;
  const color = languageHex(repo.language);

  return (
    <aside
      className="panel pointer-events-auto w-[min(340px,calc(100vw-2rem))] animate-driftIn overflow-hidden"
      aria-label={`Repository ${repo.name}`}
    >
      {/* language stripe */}
      <div className="h-[2px] w-full" style={{ background: color }} />

      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5">
            Island {String(island.index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
          <h2 className="break-words font-display text-[26px] leading-[1.05] text-bone">
            {repo.name}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
          <CloseIcon className="text-[13px]" />
        </button>
      </div>

      {repo.description && (
        <p className="px-4 pb-4 font-ui text-[13px] leading-relaxed text-ash">{repo.description}</p>
      )}

      <div className="mx-4 h-px bg-bone/[0.07]" />

      {/* metrics */}
      <div className="grid grid-cols-3 divide-x divide-bone/[0.07] px-4 py-3">
        {[
          { icon: <StarIcon />, label: 'Stars', value: formatCount(repo.stars) },
          { icon: <ForkIcon />, label: 'Forks', value: formatCount(repo.forks) },
          { icon: <IssueIcon />, label: 'Issues', value: formatCount(repo.openIssues) },
        ].map((m, i) => (
          <div key={m.label} className={i === 0 ? 'pr-3' : 'px-3'}>
            <div className="mb-0.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide2 text-ash/60">
              <span className="text-[11px] text-brass/70">{m.icon}</span>
              {m.label}
            </div>
            <div className="font-display text-lg leading-tight text-bone">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mx-4 h-px bg-bone/[0.07]" />

      {/* facts */}
      <dl className="space-y-1.5 p-4 font-mono text-[11px]">
        {[
          repo.language && [
            'Language',
            <span key="l" className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px]" style={{ background: color }} />
              {repo.language}
            </span>,
          ],
          ['Last push', relativeTime(repo.pushedAt)],
          ['Created', relativeTime(repo.createdAt)],
          ['Size', `${formatCount(repo.sizeKb)} KB`],
          repo.license && ['License', repo.license],
          repo.isArchived && ['Status', <span key="a" className="text-ember">Archived</span>],
          repo.isFork && ['Origin', 'Fork'],
        ]
          .filter(Boolean)
          .map((row) => {
            const [k, v] = row as [string, React.ReactNode];
            return (
              <div key={k} className="flex gap-3">
                <dt className="w-[72px] shrink-0 text-ash/55">{k}</dt>
                <dd className="text-bone/85">{v}</dd>
              </div>
            );
          })}
      </dl>

      {repo.topics.length > 0 && (
        <>
          <div className="mx-4 h-px bg-bone/[0.07]" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {repo.topics.slice(0, 8).map((t) => (
              <span key={t} className="chip cursor-default">
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mx-4 h-px bg-bone/[0.07]" />

      <div className="flex gap-2 p-4">
        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-primary flex-1"
        >
          Open on GitHub
          <ExternalIcon className="text-[12px]" />
        </a>
        {repo.homepage && (
          <a
            href={repo.homepage}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-icon"
            aria-label="Open project site"
          >
            <ExternalIcon className="text-[13px]" />
          </a>
        )}
      </div>

      {/* step through islands */}
      <div className="flex items-center justify-between border-t border-bone/[0.07] px-4 py-2">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="font-mono text-[10px] uppercase tracking-wide2 text-ash/60 transition-colors hover:text-brass"
        >
          [ Previous
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="font-mono text-[10px] uppercase tracking-wide2 text-ash/60 transition-colors hover:text-brass"
        >
          Next ]
        </button>
      </div>
    </aside>
  );
}
