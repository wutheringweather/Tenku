import type { IslandSpec, ProfileBundle, WorldSpec } from '@/three/types';
import { world } from '@/config/site';
import { languageColor } from './languages';
import { hash, rng } from './math';

/**
 * Places repositories in space. The rules are deliberately legible so that a
 * viewer can read the world back into facts:
 *
 *   ring     — rank by stars. The most-starred work orbits closest to you.
 *   radius   — landmass size grows with forks (how far the work has travelled).
 *   spire    — monolith height grows with stars (how far it has been seen).
 *   altitude — recency. Freshly pushed repos float high; dormant ones sink.
 *   colour   — primary language.
 */
export function deriveWorld(bundle: ProfileBundle): WorldSpec {
  const placed = bundle.repos.slice(0, world.maxIslands);
  const overflow = Math.max(0, bundle.repos.length - placed.length);

  const maxStars = Math.max(1, ...placed.map((r) => r.stars));
  const maxForks = Math.max(1, ...placed.map((r) => r.forks));
  const now = Date.now();

  const islands: IslandSpec[] = placed.map((repo, index) => {
    const ring = Math.floor(index / world.perRing);
    const slot = index % world.perRing;
    const perRing = Math.min(world.perRing, placed.length - ring * world.perRing);

    const seedInt = hash(repo.fullName);
    const rand = rng(seedInt);
    const seed = rand();

    // Offset each ring so islands never line up into spokes.
    const angle =
      (slot / perRing) * Math.PI * 2 + ring * 0.41 + (seed - 0.5) * (0.55 / Math.max(1, perRing / 4));

    const radialJitter = (rand() - 0.5) * world.ringSpacing * 0.3;
    const dist = world.ringRadius + ring * world.ringSpacing + radialJitter;

    // Recency drives altitude. 0 days old = high, 2 years+ = low.
    const ageDays = Math.max(0, (now - new Date(repo.pushedAt).getTime()) / 86400000);
    const freshness = Math.exp(-ageDays / 260); // 1 → 0 over roughly a year
    const altitude = -14 + freshness * 26 + (rand() - 0.5) * 7;

    const starT = Math.log10(1 + repo.stars) / Math.log10(1 + maxStars);
    const forkT = Math.log10(1 + repo.forks) / Math.log10(1 + maxForks);

    return {
      repo,
      index,
      x: Math.cos(angle) * dist,
      y: altitude,
      z: Math.sin(angle) * dist,
      ring,
      radius: 4.6 + forkT * 7.4 + starT * 2.2,
      spire: 7 + starT * 34,
      color: languageColor(repo.language),
      seed,
    };
  });

  return {
    bundle,
    islands,
    totalStars: bundle.repos.reduce((sum, r) => sum + r.stars, 0),
    overflow,
  };
}

/** Language breakdown by repo count, biggest first. Used by the profile panel. */
export function languageBreakdown(bundle: ProfileBundle, limit = 5) {
  const tally = new Map<string, number>();
  for (const repo of bundle.repos) {
    if (!repo.language) continue;
    tally.set(repo.language, (tally.get(repo.language) ?? 0) + 1);
  }
  const total = [...tally.values()].reduce((a, b) => a + b, 0) || 1;
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([language, count]) => ({ language, count, share: count / total }));
}
