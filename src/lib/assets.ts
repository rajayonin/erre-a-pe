/**
 * Maps paths inside `data/` to Vite-served URLs.
 *
 * Everything under `data/album-covers/` is picked up at build
 * time via import.meta.glob, so assets live in `data/` with the YAML sources.
 */
const coverUrls = import.meta.glob('/data/album-covers/*', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const byRelativePath = new Map<string, string>();
for (const [key, url] of Object.entries(coverUrls)) {
  byRelativePath.set(key.replace(/^\/data\//, ''), url);
}

/** "album-covers/foo.jpeg" (relative to data/) -> served URL, or null. */
export function assetUrl(dataRelativePath?: string | null): string | null {
  if (!dataRelativePath) return null;
  return byRelativePath.get(dataRelativePath) ?? null;
}
