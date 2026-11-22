import { buildCatalog } from '../lib/catalog';
import type { Catalog } from '../lib/types';

let cache: Catalog | null = null;

/** Build the catalog once per process and reuse it on every page. */
export async function buildCatalogCached(): Promise<Catalog> {
  cache ??= await buildCatalog();
  return cache;
}
