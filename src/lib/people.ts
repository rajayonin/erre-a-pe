import type { Group, Person, RawGroup, RawPerson } from './types';
import { normalizeName, slugify, unique } from './slug';

export const PERSON_COLORS = [
  '#f28e2b',
  '#6fc3df',
  '#e879a6',
  '#4c78a8',
  '#b79cff',
  '#f08a5d',
  '#e45756',
  '#8e6cba',
];

export class PeopleState {
  people: Person[] = [];
  private byId = new Map<string, Person>();
  private aliasIndex = new Map<string, Person>();
  private colorIndex = 0;
  private warnings: string[];

  constructor(warnings: string[]) {
    this.warnings = warnings;
  }

  private nextColor(): string {
    return PERSON_COLORS[this.colorIndex++ % PERSON_COLORS.length];
  }

  private register(name: string, person: Person): void {
    const key = normalizeName(name);
    if (key && !this.aliasIndex.has(key)) this.aliasIndex.set(key, person);
  }

  private make(raw: RawPerson): Person {
    const name = raw['artist-name'];
    const id = slugify(name);
    if (!id) throw new Error(`Cannot derive an id from artist name "${name}"`);
    if (this.byId.has(id)) throw new Error(`Duplicate artist id "${id}" (${name})`);

    const person: Person = {
      id,
      name,
      aliases: raw.aliases ?? [],
      groups: [],
      color: this.nextColor(),
      birthyear: raw.birthyear
    };
    if (raw.passed !== undefined) person.passed = raw.passed;
    if (raw.carreer) person.carreer = raw.carreer;
    if (raw['full-name']) person.fullName = raw['full-name'];
    if (raw.birthplace) person.birthplace = raw.birthplace;

    this.people.push(person);
    this.byId.set(id, person);
    return person;
  }

  load(artists: RawPerson[]): void {
    artists.forEach((raw) => this.make(raw));

    // Canonical names win over aliases when two people could match the same key.
    for (const person of this.people) this.register(person.name, person);
    for (const person of this.people) {
      for (const alias of person.aliases) this.register(alias, person);
    }
  }

  /** Register a person referenced only inline (song or group), if not already known. */
  ensurePerson(name: string, context: string): Person {
    const key = normalizeName(name);
    const found = this.aliasIndex.get(key);
    if (found) return found;

    const id = slugify(name);
    if (!id) throw new Error(`Cannot derive an id from "${name}" referenced by ${context}`);
    const existing = this.byId.get(id);
    if (existing) return existing;

    const person: Person = {
      id,
      name: String(name).trim(),
      aliases: [],
      groups: [],
      color: this.nextColor(),
    };
    this.people.push(person);
    this.byId.set(id, person);
    this.register(person.name, person);
    this.warnings.push(`Added missing artist "${name}" referenced by ${context}.`);
    return person;
  }

  resolvePerson(name: string): Person | null {
    return this.aliasIndex.get(normalizeName(name)) ?? null;
  }

  byIdOrThrow(id: string, context: string): Person {
    const person = this.byId.get(id);
    if (!person) throw new Error(`${context} references unknown person "${id}"`);
    return person;
  }
}

/** Resolve an artist name to a known person or group, for info triggers. */
export function resolveArtistInfo(
  people: Person[],
  groups: Group[],
  name: string,
): Person | Group | null {
  const key = normalizeName(name);
  const group = groups.find(
    (entry) =>
      normalizeName(entry.name) === key ||
      normalizeName(entry.name.replace(/\s*\([^)]*\)/g, '')) === key,
  );
  if (group) return group;
  return (
    people.find(
      (person) =>
        normalizeName(person.name) === key || person.aliases.some((alias) => normalizeName(alias) === key),
    ) ?? null
  );
}

export function normalizeGroups(sourceGroups: RawGroup[], state: PeopleState): Group[] {
  const groups: Group[] = [];
  const seen = new Set<string>();

  for (const source of sourceGroups) {
    const id = source.id ?? slugify(source.name);
    if (seen.has(id)) throw new Error(`Duplicate group id "${id}" (${source.name})`);

    const group: Group = {
      id,
      name: source.name,
      carreer: source.carreer,
      mcs: unique((source.mcs ?? []).map((name) => state.ensurePerson(name, `group "${source.name}"`).id)),
      djs: unique((source.djs ?? []).map((name) => state.ensurePerson(name, `group "${source.name}"`).id)),
    };

    groups.push(group);
    seen.add(id);
  }

  for (const group of groups) {
    for (const personId of [...group.mcs, ...group.djs]) {
      const person = state.byIdOrThrow(personId, `Group "${group.name}"`);
      if (!person.groups.some((entry) => entry.id === group.id)) {
        person.groups.push({ id: group.id, name: group.name });
      }
    }
  }

  return groups;
}
