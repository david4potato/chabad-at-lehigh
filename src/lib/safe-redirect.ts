/**
 * Only allow redirects to paths on this site (prevents open redirects such as
 * ?next=https://evil.example or ?next=//evil.example).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  const original = next.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(original);
  } catch {
    return fallback;
  }
  // A raw path keeps its own encoding (so "%26" inside a query survives); a
  // fully encoded path ("%2Fevents") is used decoded. Both forms are checked.
  const result = original.startsWith("/") ? original : decoded;
  for (const value of [result, decoded]) {
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
    if (/[\u0000-\u001f]/.test(value) || value.includes("\\")) return fallback;
    if (value.startsWith("/auth/") || value === "/sign-in" || value.startsWith("/sign-in?")) return fallback;
  }
  return result.length > 500 ? fallback : result;
}

export const NEXT_COOKIE = "post_auth_next";
