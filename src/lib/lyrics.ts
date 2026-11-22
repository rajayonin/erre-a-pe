import type { PartKind, Performer, Person } from './types';
import { normalizeName } from './slug';

const FALLBACK_COLORS = ['#f28e2b', '#6fc3df', '#e879a6', '#4c78a8', '#b79cff', '#f08a5d', '#e45756', '#8e6cba'];

export function colorForUnknown(name: string): string {
  let hash = 0;
  for (const char of String(name)) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function detectKind(label: string): PartKind {
  const key = normalizeName(label);
  if (/^intro/.test(key)) return 'intro';
  if (/^(preestribillo|precoro)/.test(key)) return 'pre-chorus';
  if (/^(estribillo|coro)/.test(key)) return 'chorus';
  if (/^verso/.test(key)) return 'verse';
  if (/^puente/.test(key)) return 'bridge';
  if (/^interludio/.test(key)) return 'interlude';
  if (/^(outro|final)/.test(key)) return 'outro';
  return 'other';
}

function splitPerformers(raw: string): string[] {
  return raw
    .split(/\s*(?:,|&|\/)\s*|\s+y\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

interface ParsedHeader {
  label: string;
  performers: string[];
  repeat?: number;
}

function parseHeader(content: string, lookupPerson: (name: string) => { name: string } | null): ParsedHeader {
  const colon = content.indexOf(':');

  if (colon !== -1) {
    return {
      label: content.slice(0, colon).trim(),
      performers: splitPerformers(content.slice(colon + 1)),
    };
  }

  // Tolerate headers without a colon, such as "[Pre-Estribillo Kase.O]".
  const words = content.trim().split(/\s+/);
  for (let index = 1; index < words.length; index += 1) {
    const candidate = words.slice(index).join(' ');
    const performers = splitPerformers(candidate);
    if (performers.length && performers.every((name) => lookupPerson(name))) {
      return { label: words.slice(0, index).join(' '), performers };
    }
  }

  return { label: content.trim(), performers: [] };
}

export interface ParsedLyrics {
  songId: string;
  parts: {
    id: string;
    label: string;
    repeat?: number;
    kind: PartKind;
    performers: Performer[];
    stanzas: string[][];
  }[];
}

/**
 * Parse a plain-text lyrics file:
 *
 *   [Intro: Kase.O]
 *   line
 *   line
 *
 * Blank lines separate stanzas. Every [Label: Person, Person] header starts a part.
 */
export function parseLyrics(
  text: string,
  options: {
    songId: string;
    lookupPerson?: (name: string) => Person | null;
  },
): ParsedLyrics {
  const { songId, lookupPerson = () => null } = options;
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const parts: ParsedLyrics['parts'] = [];
  let current: ParsedLyrics['parts'][number] | null = null;
  let stanza: string[] = [];
  let partNumber = 0;

  const resolvePerformer = (rawName: string): Performer => {
    const name = rawName.trim();
    const person = lookupPerson(name);
    if (person) return { id: person.id, name: person.name, kind: person.kind, color: person.color };
    return { id: null, name, kind: 'other', color: colorForUnknown(name) };
  };

  const flushStanza = () => {
    if (current && stanza.length) {
      current.stanzas.push(stanza);
      stanza = [];
    }
  };

  const flushPart = () => {
    flushStanza();
    if (current && current.stanzas.length) parts.push(current);
    current = null;
  };

  const startPart = (label: string, performerNames: string[], repeat?: number) => {
    flushPart();
    partNumber += 1;

    const seen = new Set<string>();
    const performers: Performer[] = [];
    for (const performerName of performerNames) {
      const performer = resolvePerformer(performerName);
      const key = performer.id ?? normalizeName(performer.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      performers.push(performer);
    }

    current = {
      id: `part-${partNumber}`,
      label: label.trim() || 'Letra',
      ...(repeat ? { repeat } : {}),
      kind: detectKind(label),
      performers,
      stanzas: [],
    };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushStanza();
      continue;
    }

    const header = line.match(/^\[(.+)\](?:\s+\(x(\d+)\))?$/i);
    if (header) {
      const parsed = parseHeader(header[1], lookupPerson);
      const repeat = header[2] ? Number(header[2]) : undefined;
      startPart(parsed.label, parsed.performers, repeat && repeat > 1 ? repeat : undefined);
      continue;
    }

    if (!current) startPart('Letra', []);
    stanza.push(line);
  }

  flushPart();

  return { songId, parts };
}
