export function normalizeTaskInput(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
