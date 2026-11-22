# Data schemas

This folder holds the JSON Schemas for the YAML sources and for the generated
catalogue consumed by the site. They are the contract between the data files and
the build pipeline, and they double as documentation for every field.

All schemas use [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/schema)
and share the `https://erre-a-pe.local/schemas/` `$id` namespace so they can
reference each other. `scripts/lib/schemas.mjs` registers every
`*.schema.json` file with Ajv (`strict: true`, `allErrors: true`) before
validation runs.

## Files

### Shared

| File               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `common.schema.json` | Reusable definitions: `slug`, `nonEmptyString`, `url`, `hexColor`, `link`, `groupRef`, `personId`, `albumId`. |

### Source files (`*.yaml`)

These validate the hand-written YAML before normalization.

| File                     | Validates       | Required root key | Notes                                                                 |
| ------------------------ | --------------- | ----------------- | --------------------------------------------------------------------- |
| `mcs-file.schema.json`    | `mcs.yaml`      | `mcs`             | Each MC needs `artist-name`; optional `full-name`, `aliases`, `birthplace`. |
| `djs-file.schema.json`    | `djs.yaml`      | `djs`             | Same shape as an MC entry.                                            |
| `groups-file.schema.json` | `groups.yaml`   | `groups`          | Each group needs `name`; optional `id`, `mcs`, `djs`.                  |
| `albums-file.schema.json` | `albums.yaml`   | `albums`          | Each album needs `title` and `artist`; optional `id`, `year`, `place`, `label`, `cover`, `links`. |
| `songs-file.schema.json`  | `songs.yaml`    | `songs`           | Each song needs `id`, `title`, `artist`, `album`; optional `features`, `mcs`, `djs`, `lyrics`, `links`. |

Source-file schemas describe what you may write, not the final data. References
such as `album`, `mcs` and `djs` are plain strings at this stage; they are
resolved during normalization.

### Generated catalogue

| File                    | Describes                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `catalog.schema.json`   | The whole `site/data/catalog.json` document: `meta`, `people`, `groups`, `albums`, `songs`. |
| `person.schema.json`    | A normalized MC/DJ/other person, including slug `id`, `kind`, `color`, `aliases` and group references. |
| `group.schema.json`     | A normalized group with `mcs` and `djs` as person IDs.            |
| `album.schema.json`     | A normalized album, including the derived `songIds` list.         |
| `song.schema.json`      | A normalized song: resolved `albumId`, `features`, `credits`, parsed `lyrics`, generated `listen` search URLs, optional `links`. |
| `lyrics.schema.json`    | A parsed lyrics document: `parts` with `label`, inferred `kind`, `performers`, and `stanzas`. |

`lyrics.schema.json` is referenced from `song.schema.json` (and may be `null` for
a song without lyrics). There is no schema for the raw `.txt` lyrics because
they are not JSON; the parser in `scripts/lib/lyrics.mjs` turns them into the
shape defined here.

## Validation flow

`npm run validate` and `npm run build` both call `buildCatalog()` in
`scripts/lib/data.mjs`:

1. `loadSource()` reads the five YAML files and validates each one against its
   source schema. A failure names the file and the offending instance path.
2. The data is normalized: slugs are derived, aliases resolved, album and song
   references checked, and lyrics parsed.
3. The finished catalogue is validated against `catalog.schema.json` (which
   pulls in the person, group, album, song and lyrics schemas).
4. `build` additionally writes `site/data/catalog.json` and copies assets;
   `validate` stops after step 3.

Failures are fatal and print every Ajv error, for example:

```text
Invalid songs.yaml:
  /songs/0/album must match pattern "^[a-z0-9]+(?:-[a-z0-9]+)*$"
```

Warnings are non-fatal and printed with a `warning:` prefix. They cover missing
covers, unknown feature groups, auto-registered people and empty lyrics.

## Conventions

- Every object schema sets `additionalProperties: false`; unknown keys are
  rejected instead of silently ignored.
- IDs are lowercase ASCII slugs: letters and digits separated by single dashes
  (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Accents are transliterated when generating
  slugs (`El Soñador` → `el-sonador`).
- Text fields reject empty or whitespace-only strings.
- Colours are six-digit hex values (`#f2a93b`).
- Links are absolute `http(s)` URLs with a `label`.
- Adding a new `*.schema.json` file is enough for Ajv to pick it up at build
  time; reference it with an absolute `$id` or a relative `$ref`.

See the root [README](../README.md) for the data-editing workflow and the
lyrics file format.
