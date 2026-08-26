import { Company } from "@/models/Company";
import { slugify, isValidSlug } from "@/lib/slug-shared";

export { slugify, isValidSlug } from "@/lib/slug-shared";

export async function generateUniqueSlug(name: string): Promise<string> {
  let base = slugify(name);
  if (!base || base.length < 2) base = "company";

  if (isValidSlug(base)) {
    const exists = await Company.exists({ slug: base });
    if (!exists) return base;
  }

  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    if (isValidSlug(candidate)) {
      const exists = await Company.exists({ slug: candidate });
      if (!exists) return candidate;
    }
  }

  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}
