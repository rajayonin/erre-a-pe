import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'js-yaml';
import { parseLyrics } from './lyrics';
import { PeopleState, normalizeGroups } from './people';
import type { Album, Catalog, Group, RawAlbum, RawGroup, RawPerson, RawSite, RawSong, Song } from './types';
import { normalizeName, slugify, unique } from './slug';

export const SITE_META = { title: 'Erre a Pé', tagline: 'Letras de rap para escuchar' };

const SOURCE_FILES = {
  site: 'site.yaml',
  artists: 'artists.yaml',
  groups: 'groups.yaml',
  albums: 'albums.yaml',
  songs: 'songs.yaml',
} as const;

const COVER_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'];

export const DATA_DIR = 'data';

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(relativePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelativePath(value: string): string {
  const relative = String(value).replaceAll('\\', '/').replace(/^\.?\//, '');
  if (relative.startsWith('..')) throw new Error(`Path escapes the repository: ${value}`);
  return relative;
}

async function readYamlFile(fileName: string): Promise<unknown> {
  const filePath = path.join(DATA_DIR, fileName);
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`Missing source file: ${filePath}`);
  }
  try {
    return load(text);
  } catch (error) {
    throw new Error(`Invalid YAML in ${fileName}: ${error instanceof Error ? error.message : error}`);
  }
}

function searchUrl(prefix: string, query: string): string {
  return `${prefix}${encodeURIComponent(query)}`;
}

async function findCover(id: string, title: string): Promise<string | null> {
  const bases = unique([id, slugify(title)]);
  for (const base of bases) {
    for (const extension of COVER_EXTENSIONS) {
      const candidate = `album-covers/${base}${extension}`;
      if (await exists(path.join(DATA_DIR, candidate))) return candidate;
    }
  }
  return null;
}

async function normalizeAlbums(sourceAlbums: RawAlbum[], warnings: string[]): Promise<Album[]> {
  const albums: Album[] = [];
  const seen = new Set<string>();

  for (const source of sourceAlbums) {
    const id = source.id ?? slugify(source.title);
    if (seen.has(id)) throw new Error(`Duplicate album id "${id}" (${source.title})`);

    const cover = source.cover
      ? normalizeRelativePath(source.cover).replace(/^album-covers\//, 'album-covers/')
      : await findCover(id, source.title);
    const coverPath = cover ? path.join(DATA_DIR, cover) : null;
    if (cover && !(coverPath && (await exists(coverPath)))) {
      throw new Error(`Cover for album "${source.title}" was not found: ${cover}`);
    }
    if (!cover) warnings.push(`Album "${source.title}" has no cover image.`);

    const album: Album = { id, title: source.title, artist: source.artist, songIds: [] };
    if (source.year !== undefined) album.year = source.year;
    if (source.place) album.place = source.place;
    if (source.label) album.label = source.label;
    if (cover) album.cover = cover;
    if (source.links) album.links = source.links;

    albums.push(album);
    seen.add(id);
  }

  return albums;
}

async function normalizeSongs(
  sourceSongs: RawSong[],
  context: { albums: Album[]; peopleState: PeopleState; groups: Group[]; warnings: string[] },
): Promise<Song[]> {
  const { albums, peopleState, groups, warnings } = context;
  const songs: Song[] = [];
  const seen = new Set<string>();
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const albumByTitle = new Map(albums.map((album) => [normalizeName(album.title), album]));

  const requirePerson = (name: string, label: string) => {
    const person = peopleState.resolvePerson(name);
    if (!person) throw new Error(`Unknown artist "${name}" in ${label}`);
    return person.id;
  };

  for (const source of sourceSongs) {
    const id = source.id ?? slugify(source.title);
    if (seen.has(id)) throw new Error(`Duplicate song id "${id}" (${source.title})`);

    const album = albumById.get(source.album) ?? albumByTitle.get(normalizeName(source.album));
    if (!album) throw new Error(`Song "${source.title}" references unknown album "${source.album}"`);

    const label = `song "${source.title}"`;
    const mcs = unique((source.mcs ?? []).map((name) => requirePerson(name, label)));
    const djs = unique((source.djs ?? []).map((name) => requirePerson(name, label)));
    const features = unique(source.features ?? []);

    for (const feature of features) {
      const isGroup = groups.some((group) => normalizeName(group.name) === normalizeName(feature));
      const isPerson = peopleState.resolvePerson(feature) !== undefined;
      if (!isGroup && !isPerson) {
        warnings.push(`Feature "${feature}" in ${label} is not listed in groups.yaml or artists.yaml.`);
      }
    }

    let lyrics: Song['lyrics'] = null;
    if (source.lyrics) {
      const lyricsPath = normalizeRelativePath(source.lyrics);
      let text: string;
      try {
        text = await readFile(path.join(DATA_DIR, lyricsPath), 'utf8');
      } catch {
        throw new Error(`Lyrics file for ${label} was not found: ${lyricsPath}`);
      }
      const parsed = parseLyrics(text, { songId: id, lookupPerson: (name) => peopleState.resolvePerson(name) });
      lyrics = { source: lyricsPath, ...parsed };
      if (!parsed.parts.length) warnings.push(`Lyrics for ${label} are empty.`);
    } else {
      warnings.push(`${label} has no lyrics file.`);
    }

    const query = `${source.artist} ${source.title}`;
    const song: Song = {
      id,
      title: source.title,
      artist: source.artist,
      albumId: album.id,
      features,
      credits: { mcs, djs },
      lyrics,
      listen: {
        // Direct URLs from songs.yaml win; fall back to search links.
        youtube: source.youtube?.trim() || searchUrl('https://www.youtube.com/results?search_query=', query),
        spotify: source.spotify?.trim() || searchUrl('https://open.spotify.com/search/', query),
      },
    };

    if (source.links) song.links = source.links;

    album.songIds.push(id);
    songs.push(song);
    seen.add(id);
  }

  return songs;
}

function zipSourceFiles(documents: unknown[]): RawFiles {
  const keys = Object.keys(SOURCE_FILES) as (keyof RawFiles)[];
  const result = {} as RawFiles;
  keys.forEach((key, index) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[key] = documents[index] as any;
  });
  return result;
}

interface RawFiles {
  site: { site: RawSite['site'] };
  artists: { artists: RawPerson[] };
  groups: { groups: RawGroup[] };
  albums: { albums: RawAlbum[] };
  songs: { songs: RawSong[] };
}

export async function buildCatalog(root = process.cwd()): Promise<Catalog> {
  const warnings: string[] = [];
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const documents = await Promise.all(Object.values(SOURCE_FILES).map((file) => readYamlFile(file)));
    const { site: siteFile, artists, groups, albums, songs } = zipSourceFiles(documents);
    const site = siteFile.site;

    const peopleState = new PeopleState(warnings);
    peopleState.load(artists.artists);
    const groupList = normalizeGroups(groups.groups, peopleState);

    for (const song of songs.songs) {
      for (const name of song.mcs ?? []) peopleState.ensurePerson(name, `song "${song.title}"`);
      for (const name of song.djs ?? []) peopleState.ensurePerson(name, `song "${song.title}"`);
    }

    const albumList = await normalizeAlbums(albums.albums, warnings);
    const songList = await normalizeSongs(songs.songs, {
      albums: albumList,
      peopleState,
      groups: groupList,
      warnings,
    });

    for (const warning of warnings) console.warn(`warning: ${warning}`);

    const playlist = site.playlist?.label
      ? { label: site.playlist.label, url: site.playlist.url ?? '' }
      : null;

    // Sidebar place: explicit site.yaml value, else the distinct album places.
    const albumPlaces = [...new Set(albumList.map((album) => album.place).filter(Boolean))] as string[];
    const place = site.place?.trim() || (albumPlaces.length ? albumPlaces.join(' · ') : null);

    return {
      meta: {
        title: site.title ?? SITE_META.title,
        tagline: site.tagline ?? SITE_META.tagline,
        songCount: songList.length,
        albumCount: albumList.length,
        place,
        playlist,
      },
      people: peopleState.people,
      groups: groupList,
      albums: albumList,
      songs: songList,
    };
  } finally {
    process.chdir(previousCwd);
  }
}
