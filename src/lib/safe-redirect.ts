/**
 * Only allow redirects to paths on this site (prevents open redirects such as
 * ?next=https://evil.example or ?next=//evil.example).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  let value = next.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value) || value.includes("\\")) return fallback;
  if (value.startsWith("/auth/") || value === "/sign-in" || value.startsWith("/sign-in?")) return fallback;
  return value.length > 500 ? fallback : value;
}

export const NEXT_COOKIE = "post_auth_next";
