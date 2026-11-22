import type { Group, Person, PersonKind, RawGroup, RawPerson } from './types';
import { normalizeName, slugify, unique } from './slug';

export const PERSON_COLORS = [
  '#f2a93b',
  '#6fc3df',
  '#e879a6',
  '#b6d94c',
  '#b79cff',
  '#f08a5d',
  '#7bd3b1',
  '#e6c86e',
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

  private make(raw: RawPerson, kind: PersonKind): Person {
    const name = raw['artist-name'];
    const id = slugify(name);
    if (!id) throw new Error(`Cannot derive an id from ${kind} name "${name}"`);
    if (this.byId.has(id)) throw new Error(`Duplicate ${kind} id "${id}" (${name})`);

    const person: Person = {
      id,
      name,
      kind,
      aliases: raw.aliases ?? [],
      groups: [],
      color: this.nextColor(),
      birthyear: raw.birthyear
    };
    if (raw['full-name']) person.fullName = raw['full-name'];
    if (raw.birthplace) person.birthplace = raw.birthplace;

    this.people.push(person);
    this.byId.set(id, person);
    return person;
  }

  load(mcs: RawPerson[], djs: RawPerson[]): void {
    mcs.forEach((raw) => this.make(raw, 'mc'));
    djs.forEach((raw) => this.make(raw, 'dj'));

    // Canonical names win over aliases when two people could match the same key.
    for (const person of this.people) this.register(person.name, person);
    for (const person of this.people) {
      for (const alias of person.aliases) this.register(alias, person);
    }
  }

  /** Register a person referenced only inline (song or group), if not already known. */
  ensurePerson(name: string, kind: PersonKind, context: string): Person {
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
      kind,
      aliases: [],
      groups: [],
      color: this.nextColor(),
    };
    this.people.push(person);
    this.byId.set(id, person);
    this.register(person.name, person);
    this.warnings.push(`Added missing ${kind.toUpperCase()} "${name}" referenced by ${context}.`);
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
  const group = groups.find((entry) => normalizeName(entry.name) === key);
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
      mcs: unique((source.mcs ?? []).map((name) => state.ensurePerson(name, 'mc', `group "${source.name}"`).id)),
      djs: unique((source.djs ?? []).map((name) => state.ensurePerson(name, 'dj', `group "${source.name}"`).id)),
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
