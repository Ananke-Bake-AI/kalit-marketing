# Platform Skills System

## What It Does

Platform skills are cheatsheets that teach the AI agent exactly how each ad platform's form works — every field, button, dropdown, and interaction pattern. Without a skill, the AI guesses. With a skill, it knows exactly what to fill and where.

## How It Links Together

```
1. Campaign created with platform: "x"
                ↓
2. User clicks "Deploy to X" in dashboard
                ↓
3. Extension sends to backend:
   POST /api/extension/act
   Body: { platform: "x", snapshot: {...}, campaign: {...} }
                ↓
4. Backend loads skill:
   getPlatformSkill("x")
     → Checks: .extension-skills/x.md (dynamic, auto-generated)
     → Fallback: src/lib/extension/skills/x-ads.ts (static, in code)
                ↓
5. Skill injected into Claude's system prompt:
   system: "You fill ad campaign forms. {SKILL CONTENT HERE} ..."
                ↓
6. Claude reads the skill, sees exact data-testid attributes,
   knows which field is for what, returns precise fill actions
                ↓
7. Extension executes the actions on ads.x.com
```

The `platform` string is the key that links everything:
- Campaign DB record: `platform: "x"`
- Extension message: `{ platform: "x" }`
- Skill file: `.extension-skills/x.md`
- Act endpoint: `getPlatformSkill("x")`

## File Locations

```
Dynamic skills (auto-generated, takes priority):
  apps/web/.extension-skills/
    x.md           ← X (Twitter) Ads
    meta.md        ← Meta (Facebook/Instagram) Ads  (TODO)
    linkedin.md    ← LinkedIn Ads                    (TODO)
    tiktok.md      ← TikTok Ads                     (TODO)
    reddit.md      ← Reddit Ads                      (TODO)

Static skills (fallback, checked into code):
  apps/web/src/lib/extension/skills/
    x-ads.ts       ← X Ads static fallback
    index.ts       ← Skill loader (dynamic > static)
    README.md      ← This file
```

## How to Generate / Update a Skill

### Prerequisites
- HTML dumps of each page in the ad platform's campaign creation flow
- Save them as .html files in a folder

### Generate
```bash
curl -X POST http://localhost:3002/api/internal/skills/generate \
  -H "Authorization: Bearer $SUITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platform":"x","htmlDir":"/path/to/html-dumps"}'
```

### View current skill
```bash
curl "http://localhost:3002/api/internal/skills/generate?platform=x" \
  -H "Authorization: Bearer $SUITE_API_KEY"
```

### List all platforms
```bash
curl "http://localhost:3002/api/internal/skills/generate" \
  -H "Authorization: Bearer $SUITE_API_KEY"
```

## How to Get HTML Dumps

1. Open the ad platform's campaign creation flow in your browser
2. On each page, open DevTools → Console and run:
   ```js
   copy(document.documentElement.outerHTML)
   ```
3. Paste into a .html file (one per page)
4. Name them: `Page1-CampaignSetup.html`, `Page2-AdGroup.html`, etc.

Or use the extension's auto-capture: every page visited during a deployment is automatically captured. Call `GENERATE_SKILL` via the background worker to regenerate from captures.

## Adding a New Platform

1. Collect HTML dumps of the platform's campaign creation flow
2. Run the generator:
   ```bash
   curl -X POST .../api/internal/skills/generate \
     -d '{"platform":"meta","htmlDir":"/path/to/meta-html-dumps"}'
   ```
3. The skill is saved to `.extension-skills/meta.md`
4. Add the platform URL to the extension's `manifest.json` host_permissions:
   ```json
   "host_permissions": [
     "https://adsmanager.facebook.com/*",
     ...
   ]
   ```
5. Add the URL to `background.js` platformUrls map
6. The extension + AI agent will automatically use the new skill

## When to Regenerate

- After a platform updates their UI (new fields, changed layout, renamed elements)
- After adding support for a new campaign objective/type
- If the extension starts failing on a platform that previously worked

Just get fresh HTML dumps and re-run the generator. The new skill overwrites the old one immediately.

## Platform String Reference

| Platform | String | Skill File | Ad Manager URL |
|----------|--------|------------|----------------|
| X (Twitter) | `x` | `x.md` | ads.x.com |
| Meta (FB/IG) | `meta` | `meta.md` | adsmanager.facebook.com |
| LinkedIn | `linkedin` | `linkedin.md` | linkedin.com/campaignmanager |
| TikTok | `tiktok` | `tiktok.md` | ads.tiktok.com |
| Reddit | `reddit` | `reddit.md` | ads.reddit.com |
