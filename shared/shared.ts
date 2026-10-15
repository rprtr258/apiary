export function hashmod(str: string, mod: number): number {
  const hash = [...str].map(c => c.charCodeAt(0)).reduce((h, c) => c + (h << 5) - h, 0);
  return Math.abs(hash) % mod;
}
