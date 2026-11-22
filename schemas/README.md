# Data schemas

Each source YAML file has one schema: `site.schema.json`, `artists.schema.json`,
`groups.schema.json`, `albums.schema.json` and `songs.schema.json`.
`common.schema.json` holds reusable field definitions.

All schemas use JSON Schema draft 2020-12. `bun run validate` validates each
YAML source against its schema, then builds the catalog to check references and
other data constraints. Generated catalog objects are not separately schema
validated.

Every object rejects unknown fields. IDs are lowercase ASCII slugs, text fields
reject empty strings, colors use six-digit hex values, and links use absolute
HTTP(S) URLs.
