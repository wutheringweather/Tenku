import type { ActivityDay, ProfileBundle, Repo } from '@/three/types';
import { world } from '@/config/site';
import { rng } from './math';

/**
 * A self-contained world. Used when GitHub rate-limits the visitor, when they
 * are offline, or when they just want to look around before typing a name.
 * Nothing here touches the network.
 */

const SEED_REPOS: Array<
  Pick<Repo, 'name' | 'description' | 'language' | 'stars' | 'forks' | 'topics'>
> = [
  {
    name: 'aether-engine',
    description: 'A tiny deterministic renderer for procedural worlds. No dependencies, no build step.',
    language: 'Rust',
    stars: 18420,
    forks: 942,
    topics: ['graphics', 'renderer', 'procedural'],
  },
  {
    name: 'orrery',
    description: 'Astronomical instrument layouts as a React component library.',
    language: 'TypeScript',
    stars: 9310,
    forks: 411,
    topics: ['react', 'dataviz', 'svg'],
  },
  {
    name: 'lanternfish',
    description: 'Streaming log viewer that stays fast at a million lines per second.',
    language: 'Go',
    stars: 6104,
    forks: 288,
    topics: ['cli', 'observability'],
  },
  {
    name: 'bone-white',
    description: 'A typography reset that respects the reader.',
    language: 'CSS',
    stars: 4380,
    forks: 197,
    topics: ['typography', 'css'],
  },
  {
    name: 'cartographer',
    description: 'Turn any directory tree into a navigable map.',
    language: 'Python',
    stars: 3122,
    forks: 260,
    topics: ['cli', 'visualisation'],
  },
  {
    name: 'brasswork',
    description: 'Design tokens for instrument-style interfaces.',
    language: 'JavaScript',
    stars: 2410,
    forks: 130,
    topics: ['design-system'],
  },
  {
    name: 'tideline',
    description: 'Time series smoothing that does not lie about its error bars.',
    language: 'Python',
    stars: 1890,
    forks: 145,
    topics: ['statistics'],
  },
  {
    name: 'nightjar',
    description: 'Background job runner with an honest retry story.',
    language: 'Elixir',
    stars: 1204,
    forks: 88,
    topics: ['queue', 'backend'],
  },
  {
    name: 'quiet-router',
    description: 'Routing for people who dislike routers.',
    language: 'TypeScript',
    stars: 964,
    forks: 61,
    topics: ['router'],
  },
  {
    name: 'ferrule',
    description: 'Zero-copy binary framing for embedded links.',
    language: 'C',
    stars: 742,
    forks: 54,
    topics: ['embedded'],
  },
  {
    name: 'gossamer',
    description: 'Thread-safe caching primitives, 400 lines total.',
    language: 'Rust',
    stars: 531,
    forks: 39,
    topics: ['cache'],
  },
  {
    name: 'plumbline',
    description: 'Schema drift detector for production databases.',
    language: 'Go',
    stars: 388,
    forks: 31,
    topics: ['database'],
  },
  {
    name: 'sextant',
    description: 'Geospatial helpers with no runtime dependencies.',
    language: 'TypeScript',
    stars: 267,
    forks: 22,
    topics: ['geo'],
  },
  {
    name: 'foxfire',
    description: 'Shader playground that runs entirely offline.',
    language: 'JavaScript',
    stars: 198,
    forks: 17,
    topics: ['webgl', 'shaders'],
  },
  {
    name: 'saltmarsh',
    description: 'Static site generator for field notebooks.',
    language: 'Ruby',
    stars: 121,
    forks: 9,
    topics: ['ssg'],
  },
  {
    name: 'dotfiles',
    description: 'Fifteen years of small opinions.',
    language: 'Shell',
    stars: 84,
    forks: 12,
    topics: ['dotfiles'],
  },
  {
    name: 'lodestone',
    description: 'Deterministic ID generation for distributed writes.',
    language: 'Rust',
    stars: 57,
    forks: 4,
    topics: ['distributed'],
  },
  {
    name: 'thimble',
    description: 'Very small unit test runner.',
    language: 'C++',
    stars: 31,
    forks: 3,
    topics: ['testing'],
  },
];

function buildActivity(days: number): ActivityDay[] {
  const rand = rng(0x5eed);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: ActivityDay[] = [];
  let peak = 1;
  const raw: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay();
    // Weekday-heavy, with a sprinkling of weekend sessions and the odd sprint.
    const base = dow === 0 || dow === 6 ? 0.22 : 0.78;
    const sprint = Math.sin(i / 9) * 0.5 + 0.5;
    const v = Math.round(rand() * base * (2 + sprint * 9));
    raw.push(v);
    peak = Math.max(peak, v);
  }

  for (let i = days - 1, k = 0; i >= 0; i--, k++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      count: raw[k],
      intensity: Math.sqrt(raw[k] / peak),
    });
  }
  return out;
}

export function demoBundle(): ProfileBundle {
  const now = Date.now();
  const repos: Repo[] = SEED_REPOS.map((r, i) => ({
    id: 1000 + i,
    name: r.name,
    fullName: `tenku-demo/${r.name}`,
    description: r.description,
    language: r.language,
    stars: r.stars,
    forks: r.forks,
    watchers: Math.round(r.stars * 0.9),
    openIssues: Math.round(r.forks * 0.18),
    sizeKb: 400 + i * 830,
    isFork: false,
    isArchived: i > 15,
    topics: r.topics,
    pushedAt: new Date(now - (i * 4 + 1) * 86400000).toISOString(),
    createdAt: new Date(now - (900 - i * 30) * 86400000).toISOString(),
    htmlUrl: 'https://github.com',
    homepage: i < 3 ? 'https://example.com' : null,
    license: i % 3 === 0 ? 'MIT' : i % 3 === 1 ? 'Apache-2.0' : null,
  }));

  return {
    demo: true,
    profile: {
      login: 'tenku-demo',
      name: 'The Cartographer',
      avatarUrl: '',
      bio: 'A sample world, generated locally. Type a real username to build your own.',
      company: '@tenku',
      location: 'Somewhere at dusk',
      blog: null,
      followers: 12840,
      following: 212,
      publicRepos: repos.length,
      createdAt: new Date(now - 4200 * 86400000).toISOString(),
      htmlUrl: 'https://github.com',
    },
    repos,
    activity: buildActivity(world.activityDays),
  };
}
