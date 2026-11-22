/**
 * Validates every YAML source against its JSON Schema, then builds the catalog
 * to check references and other data constraints.
 *
 *   bun run validate
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';
import { buildCatalog } from '../src/lib/catalog';

const SCHEMA_BASE = 'https://erre-a-pe.local/schemas';
const SCHEMA_FILES = {
  'site.yaml': `${SCHEMA_BASE}/site.schema.json`,
  'artists.yaml': `${SCHEMA_BASE}/artists.schema.json`,
  'groups.yaml': `${SCHEMA_BASE}/groups.schema.json`,
  'albums.yaml': `${SCHEMA_BASE}/albums.schema.json`,
  'songs.yaml': `${SCHEMA_BASE}/songs.schema.json`,
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

const schemasDir = 'schemas';
for (const file of (await readdir(schemasDir)).filter((f) => f.endsWith('.schema.json')).sort()) {
  const schema = JSON.parse(await readFile(path.join(schemasDir, file), 'utf8'));
  if (!schema.$id) throw new Error(`Schema ${file} is missing $id`);
  ajv.addSchema(schema, schema.$id);
}

function validateOrThrow(schemaId: string, data: unknown, label: string): void {
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema not registered: ${schemaId}`);
  if (validate(data)) return;
  const details = (validate.errors ?? [])
    .map((error) => `  ${error.instancePath || '/'} ${error.message}`)
    .join('\n');
  throw new Error(`Invalid ${label}:\n${details}`);
}

// Load YAML with js-yaml (same parser the build uses) and validate each document.
const fs = await import('node:fs/promises');
for (const [file, schemaId] of Object.entries(SCHEMA_FILES)) {
  const text = await fs.readFile(path.join('data', file), 'utf8');
  validateOrThrow(schemaId, load(text), file);
}

const catalog = await buildCatalog();

console.log(
  `OK: ${catalog.meta.songCount} songs, ${catalog.meta.albumCount} albums, ${catalog.people.length} people; source schemas and data references valid.`,
);
