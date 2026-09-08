export const MAX_PARTICIPANTS = 32;

export function parseItems(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function mergeItems(
  items: readonly string[],
  value: string,
  max: number,
  allowDuplicates = false,
): string[] {
  const merged = [...items];

  for (const item of parseItems(value)) {
    if (merged.length >= max) break;
    let uniqueName = item;
    let suffix = 2;
    while (!allowDuplicates && merged.includes(uniqueName)) uniqueName = `${item} (${suffix++})`;
    merged.push(uniqueName);
  }

  return merged;
}
