# Erre a Pé

A small, mobile-first lyrics companion for the [Decibelia](https://www.instagram.com/decibelia.music/) Listening Party.

Built with [Astro](https://astro.build), TypeScript, and [bun](https://bun.sh).


## Quick start

Requires [bun](https://bun.sh).

```sh
bun install
bun run dev      # dev server with hot reload
bun run build    # static build into dist/
bun run preview  # serve the dist/ build
```

| Command           | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `bun run validate`| Validates all YAML sources and the generated catalogue in memory.   |
| `bun run dev`     | Astro dev server.                                                   |
| `bun run build`   | Validates data and renders the static site into `dist/`.            |
| `bun run preview` | Serves `dist/` locally.                                             |
| `bun run check`   | TypeScript + Astro diagnostics.                                     |


## Adding a song

1. Add the album to `data/albums.yaml` if it is new:

   ```yaml
   albums:
     - title: Mi Disco
       artist: Mi Grupo
       year: 2008
       place: Zaragoza
       label: Mi Sello
       cover: album-covers/mi-disco.jpeg
   ```

   `id` is optional and derived from the title when omitted. `cover` is optional:
   the build also looks for `data/album-covers/<id>.<ext>` or
   `data/album-covers/<slug-of-title>.<ext>` with `.jpeg`, `.jpg`, `.png` or `.webp`.

2. Register the people in `data/mcs.yaml` / `data/djs.yaml` (or let the build add
   them with a warning), then add the song to `data/songs.yaml`:

   ```yaml
   songs:
     - title: Mi Canción
       artist: Mi Grupo
       album: Mi Disco
       features:
         - Otro Grupo
       mcs:
         - Kase.O
       djs:
         - R de Rumba
       lyrics: lyrics/mi-cancion
       # youtube: https://www.youtube.com/watch?v=…   # optional direct link
       # spotify: https://open.spotify.com/track/…    # optional direct link
   ```

   `album` accepts the exact album title. `features` can name a group or a
   registered MC or DJ; the build warns when a feature is not present in
   `groups.yaml`, `mcs.yaml` or `djs.yaml`.
   `youtube` and `spotify` are optional direct links per song; when left empty,
   the song page falls back to YouTube/Spotify search URLs.

3. Write the lyrics (see below) and run `bun run dev` — a new page is generated
   automatically at `/song/<id>/`.

### People and aliases

```yaml
mcs:
  - artist-name: Kase.O
    full-name: Javier Ibarra
    aliases:
      - Javat
      - Javato Jones
    birthplace: Zaragoza (La Jota)
```

`artist-name` is the canonical display name. `aliases` are matched
case-insensitively and ignoring accents, spaces and punctuation, so `RdeRumba`
resolves to `R de Rumba` and `Lirico` to `Lírico`. Canonical names win over
aliases when two people could match the same key. A person referenced by a song
but missing from the YAML files is added automatically and reported as a warning.

## Lyrics format

A lyrics file is plain text. Lines starting with `[` and ending with `]` open a
new part; blank lines separate stanzas.

```text
[Intro: Kase.O]
Primera línea
Segunda línea

[Verso 1: Kase.O]
...

[Estribillo: Lírico, Kase.O]
...
```

Add a repeat count after a part header to show a repeat badge on the song page:
`[Estribillo: Lírico, Kase.O] (x2)`.

- The label before `:` names the part. The part kind (`intro`, `verse`,
  `pre-chorus`, `chorus`, `bridge`, `interlude`, `outro`, `other`) is inferred
  from that label.
- Performers after `:` are split on `,`, `&`, `/` or ` y ` and matched against
  the people registry.
- A colon is optional when every remaining word resolves to a known performer:
  `[Pre-Estribillo Kase.O]` works.
- Unknown performers are kept with a generated colour, so a new name does not
  break the build.


## Data schemas

Every source file and the generated catalogue are described by JSON Schema
files in [`schemas/`](schemas/). See [`schemas/README.md`](schemas/README.md)
for the field-by-field overview and how validation is wired up.
