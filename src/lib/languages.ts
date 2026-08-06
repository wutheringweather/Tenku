import { hash } from './math';

/**
 * Language accents, shifted warmer/cooler than GitHub's own linguist colours so
 * they sit inside Tenku's dusk palette instead of fighting it.
 */
const LANGUAGE_COLORS: Record<string, number> = {
  TypeScript: 0x5a9bd8,
  JavaScript: 0xe0c14a,
  Python: 0x63a6c9,
  Rust: 0xd0743c,
  Go: 0x62c7d8,
  Java: 0xc9744a,
  'C++': 0xc06a8f,
  C: 0x9aa3bc,
  'C#': 0x7bbf7b,
  Ruby: 0xd8586a,
  PHP: 0x8a8ad0,
  Swift: 0xf08a4b,
  Kotlin: 0xb07ae0,
  Dart: 0x4fb3a0,
  Shell: 0x8fc98f,
  HTML: 0xe07a4a,
  CSS: 0x7f8fd8,
  SCSS: 0xd07aa8,
  Vue: 0x4fb38a,
  Svelte: 0xe0603c,
  Elixir: 0xa07ac0,
  Haskell: 0x8f7ab8,
  Lua: 0x5a7ad8,
  Zig: 0xe0a04a,
  Solidity: 0x9aa3bc,
  Move: 0x4fb3a0,
  Julia: 0xa07ad0,
  Scala: 0xd05a5a,
  Perl: 0x3aa0c0,
  'Jupyter Notebook': 0xe08a3c,
  Nix: 0x6a9fd0,
  OCaml: 0xe0863c,
  Clojure: 0x7ac07a,
  Erlang: 0xc05a7a,
  Assembly: 0xa08a6a,
  Makefile: 0x9aa3bc,
  Dockerfile: 0x5a9bd8,
  MDX: 0xe0c14a,
  Markdown: 0xf2ede3,
};

/** Deterministic fallback so unknown languages still get a stable, in-palette hue. */
function derive(key: string) {
  const h = hash(key);
  // Constrain to the dusk band: avoid pure primaries and muddy greens.
  const hue = ((h % 360) / 360) * 0.85 + 0.02;
  const sat = 0.42 + ((h >>> 9) % 22) / 100;
  const light = 0.56 + ((h >>> 17) % 14) / 100;
  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

export function languageColor(language: string | null | undefined): number {
  if (!language) return 0x6f7ea8;
  return LANGUAGE_COLORS[language] ?? derive(language);
}

export function languageHex(language: string | null | undefined): string {
  return `#${languageColor(language).toString(16).padStart(6, '0')}`;
}

export const KNOWN_LANGUAGES = Object.keys(LANGUAGE_COLORS);
