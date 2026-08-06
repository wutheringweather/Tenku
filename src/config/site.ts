/**
 * Every piece of branding lives here. Change this file, rebrand the whole app.
 * Nothing else in the codebase should hardcode a product name, colour or link.
 */

export const site = {
  name: 'TENKU',
  wordmark: 'Tenku',
  tagline: 'Your commits, as a place.',
  blurb:
    'Type a GitHub username and walk through it. Repositories become floating islands. Activity becomes light.',
  /** Shown in the entry screen bottom rail. */
  meta: {
    build: 'v1.0',
    engine: 'three.js r170',
    source: 'github public api',
  },
  links: {
    x: '',
    github: '',
    docs: '',
  },
  /** Suggested profiles on the entry screen. Keep them alive and interesting. */
  seeds: ['torvalds', 'antfu', 'gaearon', 'sindresorhus', 'yyx990803'],
} as const;

/**
 * The palette. These hexes are duplicated in tailwind.config.js for utility
 * classes and consumed here as numbers by three.js. Keep the two in sync.
 */
export const palette = {
  void: 0x070a16,
  abyss: 0x0e1428,
  slate: 0x18203c,
  brass: 0xc9a227,
  brassLo: 0x8a6f17,
  ember: 0xff8a4c,
  frost: 0x8fb8de,
  verdigris: 0x4fb3a0,
  bone: 0xf2ede3,
} as const;

/** World generation constants. Tuning these changes the shape of the archipelago. */
export const world = {
  /** Max repositories placed as islands. Beyond this they are merged into the hub. */
  maxIslands: 22,
  /** Radius of the first orbital ring. */
  ringRadius: 46,
  /** Extra radius per additional ring. */
  ringSpacing: 30,
  /** Islands per ring before starting a new one. */
  perRing: 8,
  /** How far the camera sits back in orbit mode. */
  orbitDistance: 118,
  /** Days of public activity rendered as pillars around the hub. */
  activityDays: 90,
} as const;
