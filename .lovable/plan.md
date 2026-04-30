# Mobile-First Dashboard + Platform-Wide Density Sweep

## Problem

1. The "Demo Terminal" (Dashboard.tsx) renders a fixed-width `w-60` sidebar inside a horizontal `flex` row. At 375px, the sidebar consumes 64% of the viewport, the main module area collapses, and nothing reorganizes. The shell itself is the root mobile failure — every module rendered inside inherits the broken layout.
2. Across the platform, components default to `p-6 / py-8 / gap-6 / space-y-6` which produces large negative space on small screens. Cards, headers, tabs, and module wrappers all over-pad.

## Fix Part 1 — Dashboard shell (src/components/Dashboard.tsx)

Replace the fixed flex row with a responsive shell:

```text
Mobile (<768px)            Desktop (≥768px)
┌──────────────────┐       ┌──────┬─────────────────┐
│ ☰  Org · Code   │       │      │  BHI    code ⚙ 🔔│
│ ───────────────  │       │ Side ├─────────────────┤
│                  │       │ bar  │                 │
│   Module body    │       │      │   Module body   │
│                  │       │      │                 │
└──────────────────┘       └──────┴─────────────────┘
Sidebar opens as Sheet     Sidebar always visible
```

Concrete changes:
- Outer container becomes `flex flex-col md:flex-row` (stacks on mobile).
- Sidebar `<aside>` gets `hidden md:flex w-56` on desktop.
- New mobile header row above main: hamburger `<SheetTrigger>` + truncated org name + provisioning badge + settings/bell. Visible only `md:hidden`.
- The existing `<Sheet>` from shadcn (already in project) wraps the sidebar contents and is opened by the hamburger. Closing on module switch.
- Desktop header keeps BHI on the left; on mobile, BHI moves into a slim sub-row under the hamburger header so the action icons stay reachable.
- Reduce sidebar width `w-60 → w-56`, header height `h-12 → h-11`, header padding `px-4 → px-3`, sidebar padding `p-4 → p-3`, footer `p-3 → p-2`.

## Fix Part 2 — Platform-wide density sweep (codemod)

A single Python codemod rewrites Tailwind utility classes across `src/components/**` and `src/pages/**` (skipping `src/components/ui/**` to preserve shadcn primitives). Each replacement only fires when the class appears as a standalone token (word-boundary matched, no responsive prefix in front), so already-tuned classes are untouched.

Padding compression:
- `p-8` → `p-3 md:p-5`
- `p-6` → `p-3 md:p-4`
- `p-4` → `p-2 md:p-3` (only inside CardContent/CardHeader contexts — see "Targeted" below; otherwise leave alone to avoid breaking small icon buttons)
- `py-8` → `py-3 md:py-5`, `py-6` → `py-3 md:py-4`
- `px-8` → `px-3 md:px-5`, `px-6` → `px-3 md:px-4`
- `pt-8 / pb-8 / pt-6 / pb-6` → analogous halves

Gap & vertical rhythm compression:
- `gap-8` → `gap-3 md:gap-5`
- `gap-6` → `gap-3 md:gap-4`
- `gap-4` → `gap-2 md:gap-3`
- `space-y-8` → `space-y-3 md:space-y-5`
- `space-y-6` → `space-y-3 md:space-y-4`
- `space-y-4` → `space-y-2 md:space-y-3`
- Same for `space-x-*`.

Targeted (Card-only) compression:
- For lines containing `CardContent` or `CardHeader`, also rewrite bare `p-4 → p-2 md:p-3` and `p-3 → p-2 md:p-3`. This avoids touching button/icon `p-4` containers elsewhere.

Skip rules in the codemod:
- Any class already prefixed (`sm:p-6`, `md:gap-4`, etc.) → leave untouched.
- Any file under `src/components/ui/` → skipped entirely (shadcn primitives keep their defaults; consumers control density).
- Inside string literals that aren't `className` (heuristic: must appear inside a className/cn/cva context — implemented by requiring the token to live on a line that also contains `class`, `cn(`, `cva(`, or JSX `className`).

## Fix Part 3 — Container max-width audit

Spot-fix the few wrappers that cap module width too tightly on phones:
- Replace any `max-w-md / max-w-lg / max-w-xl mx-auto` inside module bodies (not modals) with `w-full max-w-xl mx-auto` so they fill 375px.
- Modals already use `max-w-lg` from shadcn `<DialogContent>` which is `w-full max-w-lg` — fine.

## Verification

After the edits I will:
1. Re-read Dashboard.tsx to confirm the responsive shell renders without JSX imbalance.
2. `rg` for any remaining bare `p-6|p-8|gap-6|gap-8|space-y-6|space-y-8` outside `src/components/ui/` — expect zero hits.
3. Open the preview at 375px in the browser tool, screenshot the Demo Terminal landing, and verify: sidebar hidden, hamburger visible, no horizontal scroll, content fills the viewport.
4. Switch to 1280px and confirm the desktop layout is unchanged aside from the slightly tighter padding.

## Files touched

- `src/components/Dashboard.tsx` — manual responsive shell rewrite.
- `~50 files under src/components/** and src/pages/**` — automated density codemod (same set as the previous mobile-first sweep, plus a few that only had padding issues).
- `mem://index.md` — append a one-liner: "Density: prefer p-3/gap-3 mobile, p-4-5/gap-4-5 desktop. Never p-6+ without responsive prefix."

## Out of scope

- Pre-existing Supabase type errors (missing tables) remain untouched.
- Module internals beyond padding (charts, tables) keep their current logic; only spacing utilities change.
- shadcn UI primitives in `src/components/ui/` are not modified.
