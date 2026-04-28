## Goal

Hydrate this Lovable project with the `idia_pay_ui-main-2/` source so the running preview IS that app — an omni-vertical OS shell that ingests a provisioning JSON and renders the appropriate dashboard/modules. Nothing from the current TanStack Start scaffold needs to survive except the Lovable wiring (`.env`, `supabase/config.toml` pointing at the connected project, and the auto-generated `src/integrations/supabase/types.ts`).

## What's there now vs what we want

Current shell (to be removed):
- TanStack Start + React 19 + Tailwind 4
- Files: `src/router.tsx`, `src/routes/`, `src/routeTree.gen.ts`, `src/styles.css`, `wrangler.jsonc`, root `vite.config.ts`, root `package.json`, `bunfig.toml`, current `src/components/ui/*`, current `src/hooks/*`, current `src/lib/utils.ts`, current `tsconfig.json`, `eslint.config.js`, `components.json`

Source app (to become the project):
- Vite + React 18 + React Router DOM + Tailwind 3 + shadcn/ui
- Entry: `src/main.tsx` → `App.tsx` → `pages/Index.tsx` → SplashScreen → ProvisioningGate → Dashboard
- ~150 components, modules (POS, Inventory, Menu, Recipes, Team, Reports, XR, Affiliate, Tax, Timesheet, Market Intelligence), modals, role-based dashboards, AI error assistant, telemetry worker, provisioning engine
- 6 Supabase edge functions
- ~40 SQL migrations

## Plan

### Step 1 — Wipe the TanStack shell

Delete:
- `src/router.tsx`, `src/routes/`, `src/routeTree.gen.ts`, `src/styles.css`
- `src/components/` (current shadcn copies — source has its own complete set)
- `src/hooks/use-mobile.tsx`, `src/lib/utils.ts`
- `wrangler.jsonc`, `bunfig.toml`, root `vite.config.ts`, root `tsconfig.json`, `eslint.config.js`, `components.json`, `.prettierrc`, `.prettierignore`
- Root `package.json` (will be replaced)

Keep:
- `.env` (has VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY for THIS connected project)
- `supabase/config.toml` (project_id = `zxyngqciipcvveigrzqt` — the connected one; do NOT use the source's `eazzwvhgkapyqzqplvvo`)
- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts` — these are the Lovable-generated clients for the connected Supabase. We'll overwrite the source's `src/integrations/supabase/client.ts` with the Lovable one so the app hits the right project.

### Step 2 — Move the source into root

Move every file/folder from `idia_pay_ui-main-2/` up one level:
- `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `components.json`, `index.html`, `README.md`, `TECHNICAL_REQUIREMENTS.md`
- `public/` (placeholder.svg, robots.txt)
- `src/` (App.tsx, App.css, main.tsx, index.css, vite-env.d.ts, components/, hooks/, lib/, pages/, store/, workers/, integrations/)
- `supabase/functions/` (6 edge functions)
- `supabase/migrations/` (~40 files)

Then delete the now-empty `idia_pay_ui-main-2/` folder.

### Step 3 — Re-point Supabase client to the connected project

The source's `src/integrations/supabase/client.ts` was wired to project `eazzwvhgkapyqzqplvvo` and uses raw `window.localStorage` (will SSR-crash but Vite SPA is fine). Overwrite it with the Lovable-generated client (already in `src/integrations/supabase/client.ts` — points at `VITE_SUPABASE_URL` from `.env`, which is `zxyngqciipcvveigrzqt`).

Keep the source's `src/integrations/supabase/types.ts` (matches the source DB schema the app code expects). After migrations run, types will align.

### Step 4 — Install dependencies

Run `bun install` so Vite, React 18, React Router, Tailwind 3, shadcn deps, recharts, react-query, lucide, zod, etc. are all present.

### Step 5 — Apply Supabase migrations

Run all ~40 SQL files from `supabase/migrations/` against the connected Supabase project (`zxyngqciipcvveigrzqt`) in chronological order via the migration tool. These create: businesses, business_users, business_locations, inventory_items, inventory_history, recipes, recipe_history, menu_items, menu_history, pos_transactions, bank_settings (+ history), financial_report_uploads, merchant_payment_configs, storage buckets (`recipe-photos`, `financial-reports`), and the supporting RLS policies.

Note: the source uses very permissive `anon_all_*` and `auth_all_*` policies. I'll apply them as-is since that's how the app is written; we can tighten later.

### Step 6 — Deploy edge functions

The 6 edge functions (`ai-error-assistant`, `parse-inventory-document`, `pay-marketing-config`, `process-nfc-payment`, `process-terminal-payment`, `redeem-gift-card`) deploy automatically once they're under `supabase/functions/`. I'll check each for required secrets (e.g. AI keys, Stripe/IDIA keys) and request them via `add_secret` before declaring the migration complete.

### Step 7 — Verify boot

The build will run automatically. Expected first render: `SplashScreen` → `ProvisioningGate` (waiting for blueprint JSON). I'll confirm no missing imports / unresolved aliases / Tailwind 3 vs 4 conflicts and fix anything that surfaces.

## Things to flag

1. **Tailwind 3 in a Lovable project**: Lovable's default tooling expects Tailwind 4, but the source app's design tokens (`hsl(var(--primary))` etc. in `tailwind.config.ts` + `index.css`) require Tailwind 3 with `tailwindcss-animate`. We'll honor the source.
2. **No SSR / no Workers**: This becomes a pure Vite SPA. `wrangler.jsonc` and TanStack server functions go away.
3. **Permissive RLS**: Source policies allow anon full access on most tables. I'll preserve this to avoid breaking the app, but it's a known security posture worth tightening later.
4. **Project ref mismatch**: I'll force the app to use the Lovable-connected project (`zxyngqciipcvveigrzqt`), not the source's original (`eazzwvhgkapyqzqplvvo`).
5. **Edge function secrets**: I'll enumerate each function's `Deno.env.get(...)` calls and ask you for any missing keys before finishing.

## Outcome

After approval, the preview will boot the IDIA Pay shell exactly as it ran in the original repo, connected to your current Supabase project with all tables, policies, buckets, and edge functions in place — ready to receive the hydration JSON from the upstream app.
