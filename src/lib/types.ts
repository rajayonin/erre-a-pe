export type PersonKind = 'mc' | 'dj';

export interface PersonGroup {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  kind: PersonKind;
  fullName?: string;
  birthplace?: string;
  birthyear?: number;
  aliases: string[];
  groups: PersonGroup[];
  color: string;
}

export interface Group {
  id: string;
  name: string;
  mcs: string[];
  djs: string[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  songIds: string[];
  year?: number;
  place?: string;
  label?: string;
  cover?: string;
  links?: Link[];
}

export interface Link {
  label: string;
  url: string;
}

export interface Performer {
  id: string | null;
  name: string;
  kind: PersonKind | 'other';
  color: string;
}

export type PartKind =
  | 'intro'
  | 'pre-chorus'
  | 'chorus'
  | 'verse'
  | 'bridge'
  | 'interlude'
  | 'outro'
  | 'other';

export interface LyricPart {
  id: string;
  label: string;
  kind: PartKind;
  performers: Performer[];
  stanzas: string[][];
}

export interface Lyrics {
  songId: string;
  source: string;
  parts: LyricPart[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  albumId: string;
  features: string[];
  credits: { mcs: string[]; djs: string[] };
  lyrics: Lyrics | null;
  listen: { youtube: string; spotify: string };
  audio?: string;
  links?: Link[];
}

export interface PlaylistLink {
  label: string;
  /** Empty until you fill it in; renders as a placeholder. */
  url: string;
}

export interface Catalog {
  meta: {
    title: string;
    tagline: string;
    songCount: number;
    albumCount: number;
    place: string | null;
    playlist: PlaylistLink | null;
  };
  people: Person[];
  groups: Group[];
  albums: Album[];
  songs: Song[];
}

/* --- Raw source shapes (matching the JSON schemas) --- */

export interface RawPerson {
  'artist-name': string;
  'full-name'?: string;
  aliases?: string[];
  birthplace?: string;
  birthyear?: number;
}

export interface RawGroup {
  id?: string;
  name: string;
  mcs?: string[];
  djs?: string[];
}

export interface RawAlbum {
  id?: string;
  title: string;
  artist: string;
  year?: number;
  place?: string;
  label?: string;
  cover?: string;
  links?: Link[];
}

export interface RawSong {
  id?: string;
  title: string;
  artist: string;
  album: string;
  features?: string[];
  mcs?: string[];
  djs?: string[];
  lyrics?: string;
  youtube?: string | null;
  spotify?: string | null;
  audio?: string;
  links?: Link[];
}

export interface RawSite {
  site: {
    title?: string;
    tagline?: string;
    place?: string | null;
    playlist?: { label?: string; url?: string | null };
  };
}
