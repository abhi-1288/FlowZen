export const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
  "localhost",
  "flowzen",
  "dashboard",
  "login",
  "signup",
  "verify",
  "health",
  "status",
  "docs",
  "careers",
  "blog",
  "support",
  "help",
  "cdn",
  "assets",
  "static",
  "public",
  "internal",
  "staging",
  "dev",
  "test",
  "beta",
  "preview",
]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 40) return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}
