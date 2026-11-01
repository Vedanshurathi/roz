/**
 * In-app return path from a query string (?next=…). Only same-site paths: "//evil.com",
 * "/\\evil.com" (browsers read "\\" as "/") and control characters fall back to "/".
 */
export function safeNext(v: string | null | undefined, fallback = '/'): string {
  if (!v || v.length > 300 || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\'))
    return fallback;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return fallback;
  return v;
}
