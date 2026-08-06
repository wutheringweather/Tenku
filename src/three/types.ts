export interface Profile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
  htmlUrl: string;
}

export interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  sizeKb: number;
  isFork: boolean;
  isArchived: boolean;
  topics: string[];
  pushedAt: string;
  createdAt: string;
  htmlUrl: string;
  homepage: string | null;
  license: string | null;
}

/** One day of derived public activity. */
export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  /** 0..1 normalised against the busiest day in the window. */
  intensity: number;
}

export interface ProfileBundle {
  profile: Profile;
  repos: Repo[];
  activity: ActivityDay[];
  /** True when this came from the bundled demo dataset rather than the live API. */
  demo: boolean;
}

/** A repository placed in 3D space, ready for the renderer. */
export interface IslandSpec {
  repo: Repo;
  index: number;
  /** World-space anchor position. */
  x: number;
  y: number;
  z: number;
  /** Ring index, 0 = innermost. */
  ring: number;
  /** Base radius of the landmass. */
  radius: number;
  /** Height of the crystal monolith. */
  spire: number;
  /** Language colour as a hex number. */
  color: number;
  /** Deterministic 0..1 seed for per-island variation. */
  seed: number;
}

export interface WorldSpec {
  bundle: ProfileBundle;
  islands: IslandSpec[];
  /** Sum of stars across placed islands, used for the hub obelisk scale. */
  totalStars: number;
  /** Repos that did not make the island cut. */
  overflow: number;
}

export type CameraMode = 'orbit' | 'flight';

export type Phase = 'portal' | 'materialize' | 'world';

/** Live per-frame readout the HUD subscribes to. */
export interface Telemetry {
  yaw: number;
  altitude: number;
  speed: number;
  fps: number;
  /** Camera position, reused object — do not retain. */
  px: number;
  py: number;
  pz: number;
}
