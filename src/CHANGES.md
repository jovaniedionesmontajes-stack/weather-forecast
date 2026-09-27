# UI/UX pass — what changed and why

## 1. Critical fix: restored `src/styles.css`
The commit `f4067c6 "Update styles.css"` had accidentally overwritten the file from
33,201 characters down to 511 — every class the app uses (`.card`, `.sidebar`,
`.hero-weather`, `.modal`, ~200 total) was undefined. Restored from the prior
commit (`e1f85e8`), which also fixed a corrupted duplicate rule inside
`.backend-status` that was hiding in that same old version (found by actually
running `npm run build`, not just reading the file).

## 2. Re-tinted to match your uploaded offline-demo design
Pulled the palette and spacing straight out of `Bakeshop_Weather_Offline.html`:
- Sidebar navy `#0d1b2a` → `#102235`, hover `#152a40` → `#1d3852`
- Accent blue `#1677d2` → `#176bc1`
- Card corners `8px` → `12px`, inputs/buttons `6px` → `8px`
- Card shadow softened to match the flatter reference look
- Status colors (ok/watch/high) unified to one consistent palette used
  everywhere — risk badges, alerts, verification results

## 3. Removed the two fake widgets, replaced with real data
- **Fake CSS "map"** (gradient roads + a decorative pin) → replaced with a real
  "Open in Google Maps" link using the branch's actual stored coordinates
  (reused your existing `mapsUrl()` helper — no new dependency).
- **Fake animated "radar"** (decorative rings/blobs, no real data) → replaced
  with your own `RainRisk` component, which was already built and already
  computing real rain-probability windows from live hourly data — it just
  wasn't wired up on the Dashboard. Gave it a proper condensed layout for
  that use (peak %, time window, risk badge) instead of squeezing the full
  24-column timeline into a narrow card.

## 4. Removed fabricated placeholder numbers
Before, the hero card showed hardcoded fallback numbers (`29°C`, `82%`
humidity, etc.) *before* real data arrived, indistinguishable from live data.
Now it shows a proper loading skeleton until the first fetch resolves.

## 5. Accessibility
- `aria-label`s added to icon-only buttons (refresh, both modal close buttons)
- Visible `:focus-visible` outline site-wide (previously only inputs had one)

## Verified
- `npm run build` succeeds cleanly
- Rendered and screenshotted: dashboard (loading + loaded), forecast page,
  add-branch modal, and a 390px mobile viewport

## Not done (flagging, didn't want to change more without checking in)
- Base font size is still 13px with a lot of 9–11px labels — legible but tight
- Other pages (Users, Audit Log, Reports) weren't in your reference file, so
  they're still on the old visual language patterns, just re-tinted with the
  new colors
