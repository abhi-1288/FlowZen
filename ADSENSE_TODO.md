# FlowZen × Google AdSense — TODO

Publisher ID: `ca-pub-9295957067074459` · Site: **https://flowzen-azure.vercel.app/**

---

## ✅ Code (done — ships on next deploy)

| Status | Item | Where |
|--------|------|-------|
| ✅ | `ads.txt` with your authorization line | `public/ads.txt` |
| ✅ | AdSense loader script (all pages, once per page) | `app/layout.tsx`, `app/docs/layout.tsx` |
| ✅ | Reusable ad component + slot registry | `components/ads/ad-slot.tsx`, `lib/ads.ts` |
| ✅ | Landing page: 2 slots (after Features, after Testimonials) | `components/landing/landing-page.tsx` |
| ✅ | Careers page: 1 footer slot | `app/careers/page.tsx` |
| ✅ | Docs: footer slot → **REMOVED** (user asked to remove) | `app/docs/layout.tsx` |
| ✅ | Dashboard slots: recruitment · board · it · profile | `app/recruitment/layout.tsx`, `app/board/layout.tsx`, `app/it/layout.tsx`, `app/profile/layout.tsx` |
| ✅ | Dev guard: placeholders in dev, real ads only in production; `localhost` never talks to Google | inside `AdSlot` |

In dev you'll see dashed **"Ad space"** boxes where ads will live. On the deployed site they're invisible until each slot ID below is filled.

---

## ☐ Your side — AdSense dashboard (adsense.google.com)

### 1. ☐ Add the site
Sites → **Add site** → `flowzen-azure.vercel.app` → verification via the code snippet is NOT needed (ownership check) → wait for **Service approved** status.

### 2. ☐ Create ad units and get slot IDs
Ads → **By ad unit** → Create → type **Display**, size **Responsive**. Create 3–5 and copy their numeric **slot IDs**, then fill them into `lib/ads.ts` → `AD_SLOT_IDS`:

| Placement key | Suggested unit |
|---------------|----------------|
| `landing-after-features` | horizontal banner |
| `landing-after-testimonials` | horizontal banner |
| `careers` | horizontal banner |
| `docs` | horizontal banner |
| `recruitment` | square/box (sidebar-style) |
| `board` / `it` / `profile` | reuse a horizontal banner ID (fine to share) |

### 3. ☐ Deploy + verify
- [ ] Deploy to Vercel
- [ ] `https://flowzen-azure.vercel.app/ads.txt` returns: `google.com, pub-9295957067074459, DIRECT, f08c47fec0942fa0`
- [ ] Dashboard → Sites shows **"Ready"/approved** (days–weeks; ads stay blank until then — this is normal)

### 4. ☐ Topic filtering ("only offices/tools-type ads")
Reality check: AdSense can only **block** categories, never force one. Contextual targeting already favors business-software ads on your careers/docs pages. As ads start running, prune them here:

- **Ads → Content → Sensitive categories** → block gambling, dating, politics, alcohol, etc.
- **Ads → Content → General categories** → appears once you have traffic; block anything off-brand
- **Ads → Review center** → inspect real ads that ran → block individual ones (the most practical early tool)

### 5. ☐ Optional extras
- [ ] Auto Ads (Ads → switch on): Google injects extra ads automatically; try later, review placement carefully
- [ ] **EU/UK consent:** your custom cookie banner isn't a Google-certified CMP — EEA users get non-personalized ads (lower revenue). Enable Google's own free CMP in dashboard: Privacy & messaging → Consent Management Platform
- [ ] If the custom domain `flowzen.app` goes live later: add it in dashboard too — `public/ads.txt` already serves on it as-is

---

## ⚠️ Policy quick list (keep this healthy)

1. **Never click your own ads** — fastest way to a ban.
2. Max ~1–2 slots per screen in the dashboard; landed where they don't touch buttons.
3. Dashboard targeting is generic (Google's crawler can't see logged-in pages) — that's expected; public pages earn better.
4. `robots: noindex` on dashboard paths is already set in the layouts — good; leave public pages indexable so contextual ads stay sharp.
