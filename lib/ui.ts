/** Joins class names, skipping falsy values. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** A stable hue (0 to 359) for a name, used to tint monogram tiles. */
export function hueOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

/** Up to two initials: "Daft Punk" → "DP", "adele" → "A", "50 Cent" → "5C". */
export function initials(text: string): string {
  const words = text
    .replace(/[([{].*?[)\]}]/g, " ")
    .split(/[\s\-_/&,.]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  const letters = words.slice(0, 2).map((word) => [...word.replace(/^[^\p{L}\p{N}]+/u, "")][0] ?? "");
  return letters.join("").toUpperCase() || "♪";
}
