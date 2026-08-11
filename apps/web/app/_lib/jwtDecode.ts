export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const padded =
      base64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
