/**
 * Reads the palette out of src/app/globals.css for renderers that can't resolve
 * CSS custom properties — the share card's Satori renderer, so far. globals.css
 * stays the only place a colour is written down (CLAUDE.md §10).
 */

/** Every `--name: value;` declared in the first `:root { … }` block. */
export function rootTokens(css: string): Record<string, string> {
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const declarations = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens: Record<string, string> = {};
  for (const [, name, value] of declarations.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Looks up tokens by name and throws on a missing one, so a rename in
    globals.css fails the build instead of rendering a colourless card. */
export function tokenReader(tokens: Record<string, string>): (name: string) => string {
  return (name) => {
    const value = tokens[name];
    if (!value) throw new Error(`globals.css :root has no --${name}`);
    return value;
  };
}
