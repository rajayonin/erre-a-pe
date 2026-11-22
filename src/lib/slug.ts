/** "Kase.O" -> "kase-o", "El Soñador" -> "el-sonador" */
export function slugify(value: string): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Aggressive comparison key: "R de Rumba" -> "rderumba", "RdeRumba" -> "rderumba" */
export function normalizeName(value: string): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}
