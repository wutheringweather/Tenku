import type { ActivityDay, Profile, ProfileBundle, Repo } from '@/three/types';
import { world } from '@/config/site';

const API = 'https://api.github.com';
const TOKEN_KEY = 'canopy.token';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly kind: 'not-found' | 'rate-limit' | 'network' | 'empty' | 'unknown',
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || import.meta.env.VITE_GITHUB_TOKEN || '';
  } catch {
    return import.meta.env.VITE_GITHUB_TOKEN || '';
  }
}

export function setToken(token: string) {
  try {
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing — token just won't persist */
  }
}

/**
 * Accepts a bare username ("torvalds"), an "@"-prefixed handle, or a pasted
 * GitHub URL (profile or repo, with or without protocol/www) and returns just
 * the login. `https://github.com/torvalds`, `github.com/torvalds/linux`, and
 * `torvalds` all resolve to the same thing.
 */
export function extractUsername(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  return (urlMatch ? urlMatch[1] : trimmed).replace(/^@/, '');
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: headers(), signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new GitHubError(
      'Could not reach GitHub.',
      'network',
      'Check your connection, then try again.',
    );
  }

  if (res.status === 404) {
    throw new GitHubError('No such user.', 'not-found', 'Check the spelling and try again.');
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
      const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 0;
      throw new GitHubError(
        'GitHub is rate limiting this address.',
        'rate-limit',
        mins
          ? `Resets in about ${mins} min. Add a token in settings to lift the limit, or enter the demo world.`
          : 'Add a token in settings to lift the limit, or enter the demo world.',
      );
    }
    throw new GitHubError('GitHub refused the request.', 'unknown', 'Try again in a moment.');
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub returned ${res.status}.`, 'unknown', 'Try again in a moment.');
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Raw API shapes — only the fields we actually read.
 * ------------------------------------------------------------------ */

interface RawUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
  html_url: string;
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  pushed_at: string;
  created_at: string;
  html_url: string;
  homepage: string | null;
  license: { spdx_id: string | null } | null;
}

interface RawEvent {
  type: string;
  created_at: string;
  payload?: { commits?: unknown[]; size?: number };
}

/* ------------------------------------------------------------------ */

function toProfile(u: RawUser): Profile {
  return {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    bio: u.bio,
    company: u.company,
    location: u.location,
    blog: u.blog,
    followers: u.followers,
    following: u.following,
    publicRepos: u.public_repos,
    createdAt: u.created_at,
    htmlUrl: u.html_url,
  };
}

function toRepo(r: RawRepo): Repo {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    watchers: r.watchers_count,
    openIssues: r.open_issues_count,
    sizeKb: r.size,
    isFork: r.fork,
    isArchived: r.archived,
    topics: r.topics ?? [],
    pushedAt: r.pushed_at,
    createdAt: r.created_at,
    htmlUrl: r.html_url,
    homepage: r.homepage || null,
    license: r.license?.spdx_id ?? null,
  };
}

/**
 * GitHub's REST API does not expose the contribution graph, so this builds an
 * honest substitute: a day-by-day count of public events over the last N days.
 * Anything older than the events window simply reads as zero — the UI labels it
 * as "public activity", never as "contributions".
 */
function toActivity(events: RawEvent[], days: number): ActivityDay[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const ev of events) {
    const key = ev.created_at.slice(0, 10);
    if (!buckets.has(key)) continue;
    // A push carrying 12 commits should read heavier than a single star.
    const weight =
      ev.type === 'PushEvent'
        ? Math.max(1, ev.payload?.size ?? ev.payload?.commits?.length ?? 1)
        : ev.type === 'PullRequestEvent' || ev.type === 'IssuesEvent'
          ? 2
          : 1;
    buckets.set(key, (buckets.get(key) ?? 0) + weight);
  }

  const counts = [...buckets.values()];
  const peak = Math.max(1, ...counts);
  return [...buckets.entries()].map(([date, count]) => ({
    date,
    count,
    // Square root keeps a single 40-commit day from flattening everything else.
    intensity: Math.sqrt(count / peak),
  }));
}

export async function fetchProfileBundle(
  username: string,
  signal?: AbortSignal,
  onProgress?: (stage: string, pct: number) => void,
): Promise<ProfileBundle> {
  const trimmedInput = username.trim();
  const login = extractUsername(username);
  if (!login) throw new GitHubError('Enter a username first.', 'empty');

  // A username never contains "/" — if the raw input does and it wasn't
  // recognised as a github.com link above, it's a link to somewhere else.
  // Call that out specifically rather than falling through to the generic
  // "not a valid username" message below.
  const isGithubUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(trimmedInput);
  if (!isGithubUrl && trimmedInput.includes('/')) {
    throw new GitHubError(
      'That link is not from github.com.',
      'not-found',
      'Paste a GitHub profile link (github.com/username) or just the username.',
    );
  }

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
    throw new GitHubError(
      'That is not a valid GitHub username.',
      'not-found',
      'Letters, numbers and single hyphens only.',
    );
  }

  onProgress?.('Locating profile', 0.08);
  const user = await get<RawUser>(`/users/${login}`, signal);

  onProgress?.('Reading repositories', 0.3);
  const rawRepos = await get<RawRepo[]>(
    `/users/${login}/repos?per_page=100&sort=pushed&direction=desc`,
    signal,
  );

  onProgress?.('Sampling public activity', 0.55);
  let events: RawEvent[] = [];
  try {
    // Two pages covers ~200 events, comfortably past the 90-day window for most users.
    const [p1, p2] = await Promise.all([
      get<RawEvent[]>(`/users/${login}/events/public?per_page=100&page=1`, signal),
      get<RawEvent[]>(`/users/${login}/events/public?per_page=100&page=2`, signal).catch(() => []),
    ]);
    events = [...p1, ...p2];
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // Activity is a nice-to-have. A profile with no readable events still gets a world.
    events = [];
  }

  const repos = rawRepos
    .map(toRepo)
    .filter((r) => !r.isFork || r.stars > 0)
    .sort((a, b) => b.stars - a.stars || +new Date(b.pushedAt) - +new Date(a.pushedAt));

  onProgress?.('Assembling terrain', 0.72);

  return {
    profile: toProfile(user),
    repos,
    activity: toActivity(events, world.activityDays),
    demo: false,
  };
}
