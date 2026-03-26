# Google Ads — Demand Gen Campaign Creation
## Platform Skill Cheatsheet v1.0
### Source: 8 HTML dumps + 7 screenshots · Demand Gen campaign "Fred Test" · 2026-03-26

---

## ⚠️ CRITICAL ARCHITECTURE NOTES (READ FIRST)

1. **Single Angular SPA** — All form sections (campaign, ad group, ad) are live in the DOM simultaneously. The page does NOT navigate between steps. Sections are accordion-collapsible panels in a left sidebar.
2. **IDs are fully dynamic** — UUIDs like `a715CED4E-BEF0-4A38-979C-0BA01A89C7B8--0` change every session. **Never target by `id`**. Use `aria-label`, `aria-required`, `data-test-id`, `debugid`, and structural CSS selectors.
3. **`_ngcontent-awn-VIDEO-*`** — This suffix is stable within the campaign editing view for Demand Gen. Angular component classes change across app versions but `aria-label` stays stable.
4. **`debugid="acx_177925851_179054344"`** appears on all primary text inputs. Can be used as a secondary fallback selector.
5. **`data-test-id="mandatoryFieldParent"`** marks every required field wrapper. Monitor `.required.no-value` vs `.required.has-value` for validation state.

---

## 1. PAGE FLOW

```
PAGE A: Account Overview
  URL: ads.google.com/aw/overview
  Entry: material-fab[aria-label="Create"] → popup menu → "Campaign"

PAGE B: New Campaign — Goal + Type Selection
  URL: ads.google.com/aw/campaigns/new  (or /aw/campaigns/add)
  Angular host: _ngcontent-awn-CM_EDITING-*
  Footer: [Agree and continue] [Cancel]

PAGE C: Demand Gen Campaign Editor (single long form)
  URL: ads.google.com/aw/campaigns/edit?... (stays constant while editing)
  Angular host: _ngcontent-awn-VIDEO-*
  Left sidebar: accordion sections (campaign settings)
  Main area: Ad group 1 → Ad 1 → Asset pickers (fly-in panels)
  Footer (Review panel): [Save campaign] / [Publish]

PAGE D: Asset Picker (modal/panel, no URL change)
  Triggered by clicking image/logo slot buttons
  Contains: asset library, scan URL, file upload, AI generation tabs

PAGE E: Campaign Overview (post-publish)
  URL: ads.google.com/aw/overview?campaignId=...
  Angular host: _ngcontent-roi-*
```

### Page C Accordion Section Order (left sidebar, top to bottom)
1. Campaign name
2. Campaign goal
3. Conversion goals
4. View-through conversion optimization
5. Target cost per action
6. Budget and dates
7. Customer acquisition
8. Brand guidelines
*(Ad group and Ad sections render in main content area to the right)*

---

## 2. PAGE B — NEW CAMPAIGN: GOAL + TYPE SELECTION

### Section: Campaign Objective (legend: "Select the goal that would make this campaign successful to you")

| Field | Selector | Value Options |
|---|---|---|
| Objective tab | `dynamic-component[role="tab"][data-value="SALES"]` | Sales |
| Objective tab | `dynamic-component[role="tab"][data-value="LEADS"]` | Leads |
| Objective tab | `dynamic-component[role="tab"][data-value="WEBSITE_TRAFFIC"]` | Website traffic *(default selected)* |
| Objective tab | `dynamic-component[role="tab"][data-value="APP_DOWNLOADS"]` | App downloads |
| Objective tab | `dynamic-component[role="tab"][data-value="AWARENESS_AND_CONSIDERATION"]` | Awareness & consideration |
| Objective tab | `dynamic-component[role="tab"][data-value="LOCAL_STORE_VISITS"]` | Local store visits |
| Objective tab | `dynamic-component[role="tab"][data-value="No objective"]` | No objective |
| Objective tab | `dynamic-component[role="tab"][data-value="UBERVERSAL"]` | Uberversal |

**Interaction:** Click `dynamic-component[data-value="TARGET"]` to select. Check `aria-selected="true"` to confirm.

### Section: Campaign Type (legend: "Select a campaign type")

| Field | Selector | Value |
|---|---|---|
| Type card | `selection-card[aria-label="Performance Max"]` | PMax |
| Type card | `selection-card[aria-label="Search"]` | Search |
| Type card | `selection-card[aria-label="Demand Gen"]` | **Demand Gen ← use this** |
| Type card | `selection-card[aria-label="Video"]` | Video |
| Type card | `selection-card[aria-label="Display"]` | Display |
| Type card | `selection-card[aria-label="Shopping"]` | Shopping |

Also available as tabs (same page, different view):
- `dynamic-component[data-value="OWNED_AND_OPERATED"]` = Demand Gen (selected when Demand Gen card active)
- `dynamic-component[data-value="SEARCH"]`, `VIDEO`, `DISPLAY`, `SHOPPING`

### Sub-type selector (after choosing Demand Gen)
```html
<div role="radiogroup" class="_ngcontent-awn-CM_EDITING-28">
  <button class="container _ngcontent-awn-CM_EDITING-30 selected" role="radio" aria-checked="true">
```
Check `aria-checked="true"` on `button[role="radio"]` inside `div[role="radiogroup"]`.

### Enhanced Conversions prompt
```html
<material-checkbox class="themeable _nghost-awn-CM_EDITING-33" aria-checked="true">
```
Appears as: "Turn on enhanced conversions for your account" — default `aria-checked="true"`. Leave as-is.

### Footer Buttons
| Button | Selector | Action |
|---|---|---|
| Agree and continue | `button.btn-yes[aria-label="Agree and continue to the next step"]` | Proceed to editor |
| Cancel | `button.btn-no[aria-label="Cancel new campaign creation"]` | Abort |

---

## 3. PAGE C — DEMAND GEN CAMPAIGN EDITOR

### SECTION: Campaign Name

**Accordion header:** `div.header[aria-label="Campaign name"]` — click to expand (check `aria-expanded="true"`)

| Field | Selector | Type | Required | Maps To |
|---|---|---|---|---|
| Campaign name | `input.input.input-area[aria-label="Campaign name"][aria-required="true"]` | text | ✅ | `campaign.name` |

```css
/* Primary selector */
input[aria-label="Campaign name"][aria-required="true"]
/* Fallback */
input[aria-label="Campaign name"][required]
```

---

### SECTION: Campaign Goal

**Accordion header:** `div.header[aria-label="Campaign goal"]`

| Field | Selector | Type | Default |
|---|---|---|---|
| Goal: Conversions | `dynamic-component[role="tab"][data-value="CampaignGoal.conversions"]` | tab | ✅ selected |
| Goal: Clicks | `dynamic-component[role="tab"][data-value="CampaignGoal.clicks"]` | tab | — |
| Goal: Conversion Value | `dynamic-component[role="tab"][data-value="CampaignGoal.conversionValue"]` | tab | disabled |
| Goal: YouTube Engagements | `dynamic-component[role="tab"][data-value="CampaignGoal.youtubeEngagements"]` | tab | — |

**Interaction:** Click the tab element. Verify `aria-selected="true"` is set on the chosen tab.

---

### SECTION: Conversion Goals

**Accordion header:** `div.header[aria-label="Conversion goals"]`

| Field | Selector | Type | Default |
|---|---|---|---|
| Conversion goal radio group | `material-radio-group[role="radiogroup"][aria-label="Select a conversion goal"]` | radiogroup | aria-disabled="true" (locked by account) |
| Active conversion radio | `material-radio[role="radio"][aria-checked="true"]` | radio | 1 action (account default) |
| Enabled actions count link | `span.enabled-primary-action-count[role="button"]` | button | shows "1 action" |

**Note:** This group may be `aria-disabled="true"` when account has existing conversion goals. The agent should read the current state and not override if locked.

---

### SECTION: View-Through Conversion Optimization

**Accordion header:** `div.header[aria-label="View-through conversion optimization"]`

| Field | Selector | Type | Default |
|---|---|---|---|
| Enable view-through | `material-checkbox.themeable._ngcontent-awn-VIDEO-63[role="checkbox"]` | checkbox | `aria-checked="false"` |

**Caution:** This checkbox has no `aria-label`. Target by its class `.themeable` within the `View-through conversion optimization` section. Check `aria-checked` state before toggling.

---

### SECTION: Target Cost Per Action

**Accordion header:** `div.header[aria-label="Target cost per action"]`

| Field | Selector | Type | Default |
|---|---|---|---|
| Enable Target CPA | `material-checkbox.themeable._ngcontent-awn-VIDEO-65[role="checkbox"]` | checkbox | `aria-checked="false"` |

**Interaction pattern:** If `aria-checked="false"` and you want to enable, click the checkbox. A `money-input` field for the CPA target amount will appear conditionally after enabling.

---

### SECTION: Budget and Dates

**Accordion header:** `div.header[aria-label="Budget and dates"]`

| Field | Selector | Type | Required | Maps To |
|---|---|---|---|---|
| Budget amount | `input[aria-label="Budget amount in $"]` | text | ✅ | `campaign.budget.amount` |
| Budget type dropdown | `div.button.border#[aria-haspopup="listbox"]` *(see note)* | dropdown | — | `campaign.budget.type` |
| Start date | `input[aria-labelledby="a30F4C498-57B6-40B2-A5A7-9FC38D2D8835--0"]` | text | — | `campaign.startDate` |
| End date | `input[aria-labelledby="a38B31560-7EAE-4BA5-A03F-81B806D802DA--0"]` | text | — | `campaign.endDate` |
| Edit budget dates button | `material-button.edit-button[aria-label="Edit budget dates"]` | button | — | trigger date picker |
| Shared budget link | `material-button.shared-budget-link` | button | — | open shared budget |

**Budget amount field full selector:**
```css
input.input.input-area[aria-label="Budget amount in $"]
/* Parent wrapper: */
money-input[data-test-id="mandatoryFieldParent"]
```

**Budget type dropdown selector (structural — ID changes):**
```css
div.button._ngcontent-awn-VIDEO-28.border[aria-haspopup="listbox"]
/* Inside section controlled by: div.header[aria-label="Budget and dates"] */
```
Opens a `listbox`. After clicking, options appear. Select by option text (e.g., "Daily" or "Campaign total").

**Radio buttons in budget section (budget period sub-choice):**
```css
/* Group name: radio-group-a07FE87D2-2B96-4675-A31D-954CDC44D1A7--0 */
input.mdc-radio__native-control[name^="radio-group"][aria-checked="false"]  /* Option 1 */
input.mdc-radio__native-control[name^="radio-group"][aria-checked="true"]   /* Option 2 (default) */
```
These are the two radio buttons for budget period type. The currently selected one has `aria-checked="true"`.

**Date fields note:** `aria-labelledby` values are dynamic. Use positional order within the `Budget and dates` accordion: first text input = start date, second = end date.

---

### SECTION: Customer Acquisition

**Accordion header:** `div.header[aria-label="Customer acquisition"]`

| Field | Selector | Type | Default |
|---|---|---|---|
| Optimize for new customers | `material-checkbox.optimize-checkbox.themeable._ngcontent-awn-VIDEO-175[role="checkbox"]` | checkbox | `aria-checked="false"` |

---

### SECTION: Brand Guidelines

**Accordion header:** `div.header[aria-label="Brand guidelines"]`

| Field | Selector | Type | Maps To |
|---|---|---|---|
| Main color | `input[aria-label="Main color"][id^="a9C89E693"]` | combobox/text | `brand.primaryColor` |
| Accent color | `input[aria-label="Accent color"][id^="a39E09E36"]` | combobox/text | `brand.accentColor` |
| Color picker (hidden) | `input.native-color-picker[type="color"][aria-hidden="true"]` | color | *don't use directly* |
| Brand name dropdown | `div.button.border[aria-haspopup="listbox"]` *(2nd in section)* | dropdown | `brand.name` |

**Main color selector (stable):**
```css
input[aria-label="Main color"]
input[aria-label="Accent color"]
```
These are combobox fields. Type a color name (e.g., "Blue") or hex value. A dropdown suggestions list appears (`aria-haspopup="listbox"`). Click the matching suggestion.

**Important:** Do NOT interact with `input.native-color-picker[type="color"]` — it is `aria-hidden="true"` and `tabindex="-1"`. Use only the text combobox fields above it.

---

### SECTION: Ad Group (main content area)

**Section header:** `h2._ngcontent-awn-VIDEO-88` — "Ad group 1"
**Management button:** `material-button[aria-label="Manage ad group: Ad group 1"]`

| Field | Selector | Type | Required | Maps To |
|---|---|---|---|---|
| Ad group name | `input[aria-label="Ad group name"][aria-required="true"]` | text | ✅ | `adGroup.name` |

```css
input[aria-label="Ad group name"][aria-required="true"]
input[aria-label="Ad group name"][required]
```

---

### SECTION: Location Targeting (inside Ad Group)

**Legend:** `legend._ngcontent-awn-VIDEO-94` — "Select locations for this campaign"

| Field | Selector | Type | Maps To |
|---|---|---|---|
| Location search input | `input[aria-labelledby^="aA0EA580D"][id^="a65EEEC8E"][role="combobox"]` | combobox | `targeting.locations[]` |
| Use campaign location switch | `input.mdc-switch__native-control[aria-label="Use campaign location and language settings"][role="switch"]` | switch | toggle |

**Location field stable selector:**
```css
/* The location combobox — use aria-haspopup="true" + role="combobox" within location section */
input[role="combobox"][aria-haspopup="true"][aria-autocomplete="list"]
```

**Interaction:** Type a country/city name → wait for suggestions list → click the matching result in the dropdown.

---

### SECTION: Language Targeting (inside Ad Group)

| Field | Selector | Type | Maps To |
|---|---|---|---|
| Language | `input[aria-label="Start typing or select a language"][role="combobox"]` | combobox | `targeting.languages[]` |

```css
input[aria-label="Start typing or select a language"]
```
Type language name → wait for listbox → click option.

---

### SECTION: Ad Scheduling (inside Ad Group)

| Field | Selector | Type | Maps To |
|---|---|---|---|
| Schedule start time | `input[aria-label="12:00 AM"][role="combobox"]:first-of-type` | combobox | `schedule.startTime` |
| Schedule end time | `input[aria-label="12:00 AM"][role="combobox"]:last-of-type` | combobox | `schedule.endTime` |

**Note:** Both have `aria-label="12:00 AM"`. Disambiguate by order in DOM: first = start, second = end. IDs differ:
- Start: `id="a6A1FF1C3-37B0-4247-9207-9932F34D0BDC--0"`
- End: `id="a8394776E-6E97-45F4-802B-6034BC23FC8C--0"`
(IDs may change — use positional order within scheduling component)

---

### SECTION: Ad 1 (main content area)

**Section header:** `h2._ngcontent-awn-VIDEO-102` — "Ad 1"
**Management button:** `material-button[aria-label="Manage ad: Ad 1"]`

| Field | Selector | Type | Required | Maps To | Char Limit |
|---|---|---|---|---|---|
| Ad name | `input[aria-label="Ad name"][aria-required="true"]` | text | ✅ | `ad.name` | — |
| Final URL | `url-input[debugid="final-url"] input` | text | ✅ | `ad.finalUrl` | — |
| Headline | `input[aria-label="Headline"]` | text | — | `ad.headlines[]` | ~30 |
| Description | `input[aria-label="Description"]` | text | — | `ad.descriptions[]` | ~90 |
| Business name | `input[aria-label="Business name"]` | text | — | `ad.businessName` | ~25 |

**Final URL wrapper detection:**
```css
url-input[debugid="final-url"][data-test-id="mandatoryFieldParent"]
/* Filled: .required.has-value */
/* Empty (error): .required.no-value */
```

**Ad name selector:**
```css
input[aria-label="Ad name"][aria-required="true"]
input[aria-label="Ad name"][required]
```

**Headline selector:**
```css
input[aria-label="Headline"]
/* has aria-controls pointing to character count element */
```

**Description selector:**
```css
input[aria-label="Description"]
```

**Business name selector:**
```css
input[aria-label="Business name"]
```

**Note on multiple instances:** In pages 1–3, the Headline/Description/Business name `aria-controls` IDs are one set. In pages 4–5 (after audience edit), they reference different IDs. The `aria-label` is identical — always use `aria-label` as primary selector. If multiple inputs share the same `aria-label`, take the one that is NOT `aria-disabled="true"` and IS within the Ad 1 section (between the "Ad 1" h2 and the Review panel).

---

### SECTION: Custom URL Parameters (inside Ad)

| Field | Selector | Type | Maps To |
|---|---|---|---|
| Parameter name | `input[aria-label="Name"]` (first instance in URL params area) | text | `ad.customParams[].name` |
| Parameter value | `input[aria-label="Value"]` | text | `ad.customParams[].value` |

**Disambiguation:** `input[aria-label="Name"]` also appears in asset library (for asset naming). Use context: these appear directly after `url-input[debugid="final-url"]`.

---

### SECTION: Text Assets — Bulk Input (inside Ad)

Multiple textareas for bulk-entering headlines/descriptions one-per-line:

```css
textarea[aria-label="Enter or paste text assets, one asset per line"]
```

There are **9 such textareas** in total. They correspond to different asset types. Differentiate by their position/order in the DOM:

| Order | aria-labelledby (stable reference) | Purpose |
|---|---|---|
| 1 | `a86E3F23B-3DFC-48DF-B0DB-039B1CA5ACA8--0` | Headlines (set 1) |
| 2 | `a65D90E15-AAF6-458A-9D29-834AA55056D8--0` | Headlines (set 2) |
| 3 | `a99C4F72E-89DE-4C38-A5A9-20D3830F1B70--0` | Descriptions (set 1) |
| 4 | `a0605C89E-6276-4D93-8083-5F9809E621F6--0` | Descriptions (set 2) |
| 5 | `a02351957-4ABA-435D-AAF0-3EC4D078753F--0` | Business names |
| 6 | `a2A0E1301-B7C6-4E20-98B5-F3B577DD62B1--0` | CTA (call-to-action) |
| 7 | `aB342EF46-21AE-44E5-807F-D3C5B0CBA600--0` | Long headlines |
| 8–9 | (dynamic) | Additional assets |

**Note:** `aria-labelledby` IDs may vary between sessions. Use DOM order position as fallback.

**Static-height textarea** (appears once, likely for ad copy preview/notes):
```css
textarea.textarea.input-area.staticHeight[style*="height: 160px"]
```

---

### SECTION: AI Image Generation (inside Asset Picker)

```css
textarea[aria-label="Describe the kind of image you want"]
```
Two instances — one per aspect ratio (landscape / portrait).
Placeholder: `"Include details about the subject, color, style, and background"`

---

### SECTION: Asset Name Fields (inside Asset Library panel)

```css
input.mdc-text-field__input[aria-label="Name"]
```
`debugid="acx_264709916"` — 7 instances total, each for naming a different asset. Use sequential index within the panel.

---

## 4. ASSET PICKER — IMAGE & LOGO UPLOAD (PAGE D)

### Asset Picker Panel Structure

Opened by clicking image/logo slot areas in Ad 1. Displays as overlay/fly-in.

### Image/Logo Slot Status Headers (read to know how many assets selected)

| ID (stable) | Purpose | Max |
|---|---|---|
| `#aC09E9F91-25E1-418D-98D2-D0F938A6DE2F--0` | Demand Gen images (landscape) | 20 |
| `#a80AEABBE-407A-4619-9FCD-D7BF3D3F317E--0` | Demand Gen logos | 5 |
| `#a61F3B690-A300-485D-A6CA-67D8E7899AB7--0` | Portrait images | 3 |
| `#aA609761C-3628-49C9-BB2D-63883CD33A2F--0` | Single logo | 1 |
| `#a23D6B6DA-03C0-4DAD-B098-A7C1509D80CA--0` | Single image | 1 |
| `#a66E02EB3-AE06-4D5D-A4DE-46D7F04A0C0F--0` | Optional images (set 1) | 5 |
| `#a7D24C078-1C55-4D91-B5D3-D7579ED9DFE0--0` | Optional images (set 2) | 5 |

**Read current count:** `h2[id="..."].sub-header` text format: `"Images for your ad (CURRENT/MAX)"`

### File Upload Inputs

| Selector | Accept Types | Use For |
|---|---|---|
| `input[type="file"][accept="image/jpeg,image/jpg,image/png,image/svg"]:not([multiple])` | jpg, png, svg | Single logo upload |
| `input[type="file"][accept="image/jpeg,image/jpg,image/png,image/svg"][multiple]` | jpg, png, svg | Multiple images upload |
| `input[type="file"][accept="image/jpeg,image/jpg,image/gif,image/png,image/svg"]` | jpg, gif, png, svg | Logos with animated GIF support |

**Upload interaction:**
```javascript
// Direct file input (hidden, use dispatchEvent)
const input = document.querySelector('input[type="file"][accept*="image"][multiple]');
// Set files programmatically then dispatch 'change' event
```

**Drag-drop target:** `h1._ngcontent-awn-VIDEO-156` — "To upload your media, drag files here"

### Website URL Scanner

| Field | Selector | Purpose |
|---|---|---|
| Website URL input | `input[aria-labelledby^="a83944F97"]` (first URL field in picker) | Scan URL for images |
| Website URL input | `input[aria-labelledby^="a4BF45F16"]` | Additional URL |

### Asset Library — Filter/Search

Multiple search boxes, one per asset category panel:

```css
input.search-box[aria-label="Add filter"][placeholder="Add filter"][role="combobox"]
```

| Instance | aria-controls (stable ref) | Panel |
|---|---|---|
| 1 | `a3CE28464-5AF8-4A07-8F29-22656D00F8C8--0` | Images (from final URL) |
| 2 | `aF04B54F6-2BEF-4BE3-AB56-7248EE970D82--0` | Logos |
| 3 | `aCD4FB60D-5979-424E-AF60-B8D671E4B809--0` | Portrait images |
| 4 | `a76ABEE8A-548E-4203-BCF6-ACB1AB6ECB8B--0` | Single image |
| 5 | `a70B87F15-A5EB-4D25-AF6E-0CF1D3BD2E48--0` | Optional images (set 1) |
| 6 | `a871AFB3B-860F-40A6-A4FC-E40EE9C43063--0` | Optional images (set 2) |
| 7 | `aAC8CE99C-FD4C-4A1E-958C-8B5918C65BA8--0` | Additional panel |

### Asset Category "Select All" Checkboxes

```css
/* From final URL category */
material-checkbox.finalUrl[data-test-id="select-all-checkbox"]

/* Stock images */
material-checkbox.stock[data-test-id="select-all-checkbox"]

/* Recently used */
material-checkbox.recentlyUsed[data-test-id="select-all-checkbox"]
```

Check `aria-checked` value: `"true"` = all selected, `"false"` = none, `"mixed"` = partial.

### Asset Grid

```css
div[data-test-id="event-assets"][role="grid"]
```

Individual asset items within the grid — click to select (no dedicated selector seen in HTML; use `role="gridcell"` children).

### Asset Picker Action Buttons

| Button | Selector | State |
|---|---|---|
| Confirm / Done | `material-button.confirm-button[data-test-id="confirm-button"]` | Disabled until ≥1 asset selected |
| Cancel | `material-button.cancel-button[data-test-id="cancel-button"]` | Always enabled |
| Add product images | `material-button[aria-label="Add product images"][data-test-id="product-image-add-button"]` | — |

**Confirm button disabled state detection:**
```css
/* DISABLED (no assets selected): */
material-button.confirm-button.is-disabled[aria-disabled="true"][disabled]

/* ENABLED (assets selected): */
material-button.confirm-button:not(.is-disabled)[aria-disabled="false"]
```
**Wait for confirm button to become enabled before clicking.**

---

## 5. SECTION: AUDIENCE TARGETING EDITOR (Page 4 — separate overlay)

Triggered by clicking audience section within Ad Group.
Angular host: `_ngcontent-dng-6` (different component than main form)

| Field | Selector | Required | Maps To |
|---|---|---|---|
| Audience segment name | `input._ngcontent-dng-6[aria-label="An input that edits the name of the audience"][aria-required="true"]` | ✅ | `audience.name` |
| Audience URL | `input._ngcontent-dng-6[aria-labelledby^="a4E17BDDB"]` | — | `audience.websiteUrl` |

---

## 6. REVIEW PANEL (Page C — right side)

**Header:** `h2._ngcontent-awn-VIDEO-82` — "Review your campaign"
**Ads sub-header:** `h3._ngcontent-awn-VIDEO-82` — "Ads"

### Performance Metrics (read-only, post-publish estimation)

```css
performance-metric[data-test-id="conversions"]        /* Primary metric */
performance-metric[data-test-id="impressions"]
performance-metric[data-test-id="average-cpa"]
performance-metric[data-test-id="days-to-first-conversion"]
performance-metric[data-test-id="first-week-conversions"]
performance-metric[data-test-id="days-in-learning-phase"]
```

---

## 7. PAGE C — NAVIGATION & HEADER BUTTONS

| Button | Selector | Action |
|---|---|---|
| Close wizard | `material-button.back-button[aria-label="Close"]` | Exit without saving |
| Google Ads logo | `app-bar-logo-container[aria-label="Google Ads – Go to starting page"]` | Home |
| Ads Advisor | `material-button[aria-label="Ads Advisor"]` | — |
| Help panel | `material-button[aria-label="Open the quick help panel"]` | — |
| Manage campaign | `material-button[aria-label^="Manage campaign:"]` | Campaign context menu |
| Manage ad group | `material-button[aria-label^="Manage ad group:"]` | Ad group context menu |
| Manage ad | `material-button[aria-label^="Manage ad:"]` | Ad context menu |

---

## 8. PAGE E — POST-PUBLISH OVERVIEW

**Campaign overview page** — angular host `_ngcontent-roi-*`

| Element | Selector | Purpose |
|---|---|---|
| Campaign FAB options | `material-fab[aria-label="Campaign options menu"]` | Edit/pause/delete menu |
| Campaign status | `div[aria-label="Change status"]` | Enable/Pause |
| Budget edit | `material-icon[aria-label="Edit"][icon="edit"]` | Edit budget inline |
| Settings | `material-button[aria-label="Settings"]` | Campaign settings page |
| Date range picker | `div.button.border[aria-label^="Mar"]` | Date range selector |

---

## 9. FIELD IDENTIFICATION CHEAT SHEET (Quick Lookup)

| Field Name | Primary Selector | Type |
|---|---|---|
| Campaign name | `input[aria-label="Campaign name"][aria-required="true"]` | text input |
| Budget amount | `input[aria-label="Budget amount in $"]` | money text |
| Ad group name | `input[aria-label="Ad group name"][aria-required="true"]` | text input |
| Language | `input[aria-label="Start typing or select a language"]` | combobox |
| Ad name | `input[aria-label="Ad name"][aria-required="true"]` | text input |
| Final URL | `url-input[debugid="final-url"] input` | text input |
| Headline | `input[aria-label="Headline"]` | text input |
| Description | `input[aria-label="Description"]` | text input |
| Business name | `input[aria-label="Business name"]` | text input |
| Main color | `input[aria-label="Main color"]` | combobox |
| Accent color | `input[aria-label="Accent color"]` | combobox |
| Location search | `input[role="combobox"][aria-haspopup="true"]` (in location section) | combobox |
| Audience name | `input[aria-label="An input that edits the name of the audience"]` | text input |
| Image AI prompt | `textarea[aria-label="Describe the kind of image you want"]` | textarea |
| Text assets (bulk) | `textarea[aria-label="Enter or paste text assets, one asset per line"]` | textarea |
| File upload (images) | `input[type="file"][accept*="image"][multiple]` | file |
| File upload (logo) | `input[type="file"][accept="image/jpeg,image/jpg,image/png,image/svg"]:not([multiple])` | file |
| Asset library filter | `input.search-box[aria-label="Add filter"]` | combobox |
| Asset confirm | `material-button.confirm-button[data-test-id="confirm-button"]` | button |
| Asset cancel | `material-button.cancel-button[data-test-id="cancel-button"]` | button |
| Goal: conversions | `dynamic-component[data-value="CampaignGoal.conversions"]` | tab |
| Goal: clicks | `dynamic-component[data-value="CampaignGoal.clicks"]` | tab |
| Goal: YouTube | `dynamic-component[data-value="CampaignGoal.youtubeEngagements"]` | tab |
| Objective: SALES | `dynamic-component[data-value="SALES"]` | tab |
| Objective: LEADS | `dynamic-component[data-value="LEADS"]` | tab |
| Objective: TRAFFIC | `dynamic-component[data-value="WEBSITE_TRAFFIC"]` | tab |
| Type: Demand Gen | `selection-card[aria-label="Demand Gen"]` | card |
| Type: Search | `selection-card[aria-label="Search"]` | card |
| Type: PMax | `selection-card[aria-label="Performance Max"]` | card |
| Agree & continue | `button.btn-yes[aria-label="Agree and continue to the next step"]` | button |
| Cancel new campaign | `button.btn-no[aria-label="Cancel new campaign creation"]` | button |
| Create (FAB) | `material-fab[aria-label="Create"]` | FAB |

---

## 10. SELECT / DROPDOWN INTERACTION RULES

### Combobox Pattern (most fields)
```
1. Click input element
2. Type search text (partial is OK)
3. Wait for dropdown: aria-expanded="true" on input OR listbox appears
4. Click desired option in listbox (role="option")
5. Verify: aria-expanded="false" and input value updated
```

### Material Dropdown (budget type, brand name)
```
1. Click div.button.border[aria-haspopup="listbox"]
2. Wait for listbox element to appear (aria-expanded="true")
3. Click option by text content or data-value
4. Verify dropdown closes
```

### Tab Selection (campaign goal, objective type)
```
1. Click dynamic-component[role="tab"][data-value="TARGET"]
2. Verify aria-selected="true" on clicked tab
3. Verify aria-selected="false" on previous tab
```

### Selection Card (campaign type)
```
1. Click selection-card[aria-label="Campaign Type"]
2. Verify selected state (check for "selected" class or aria state)
```

### Checkbox (material-checkbox)
```
1. Read current aria-checked value
2. If NOT in desired state, click the element
3. Verify aria-checked flipped
Note: Do NOT use native click on inner input — click the material-checkbox element
```

### Switch (mdc-switch)
```
input.mdc-switch__native-control[role="switch"]
1. Read aria-checked state
2. Click the parent switch container (not the hidden input directly)
3. Verify aria-checked changed
```

---

## 11. BUDGET RULES

| Rule | Detail |
|---|---|
| **Field type** | Text input, NOT a number input — type as string e.g. `"50"` or `"50.00"` |
| **Currency** | USD (`$`) — the aria-label says "Budget amount in $" |
| **Daily vs Total** | Controlled by the `div.button.border` dropdown within the Budget section. Default behavior suggests daily. Check dropdown selection. |
| **Wrapper** | `money-input[data-test-id="mandatoryFieldParent"]` — required field |
| **Validation** | Class `.required.no-value` = unfilled, shows validation error |
| **Minimum** | Google enforces minimum daily budget ($1–$5 depending on settings) — no client-side minimum visible in HTML |
| **Shared budgets** | `material-button.shared-budget-link` — if clicked, switches to shared budget mode (different flow) |
| **Radio group** | Two radios in `name="radio-group-a07FE87D2-2B96-4675-A31D-954CDC44D1A7--0"` — likely "Optimize" vs "Fixed" budget delivery. Second option (`id="a991EF56A..."`) is default selected |

---

## 12. CREATIVE / AD PAGE RULES

### Required vs Optional Fields
| Field | Required | Notes |
|---|---|---|
| Ad name | ✅ (`aria-required="true"`) | Internal label only |
| Final URL | ✅ (`.required.no-value` detection) | Must include https:// |
| Headline | ❌ (recommended) | Up to 5 headlines per Demand Gen ad |
| Description | ❌ (recommended) | Up to 5 descriptions |
| Business name | ❌ (recommended) | Appears in ad |
| Images (landscape 20) | ✅ min required | Must select ≥1 |
| Logos (5) | ✅ min required | Must select ≥1 |

### Conditional Field Rendering
- **Target CPA amount input**: Only appears after enabling `material-checkbox.themeable._ngcontent-awn-VIDEO-65` (Target CPA checkbox). Not visible otherwise.
- **End date field**: Only appears after clicking "Edit budget dates" — not always visible.
- **Customer acquisition options**: Expand after checking `material-checkbox.optimize-checkbox`.
- **Asset picker confirm button**: Only becomes enabled after ≥1 asset is checked in the grid.

### Final URL Validation States
```css
/* Not yet filled: */
url-input.required.no-value
div.required.no-value[data-test-id="mandatoryFieldParent"]

/* Filled correctly: */
url-input.required.has-value
div.required.has-value[data-test-id="mandatoryFieldParent"]
```

### Headline/Description Character Counts
- Headline inputs reference a character-count element via `aria-describedby` / `aria-controls`
- The counter element ID is dynamic — read `aria-controls` value from the input, then find element with that ID to check remaining chars
- Safe to type full text and let Google truncate warning appear (non-blocking)

---

## 13. ERROR PATTERNS

### Required Field Not Filled
```css
/* Wrapper has both 'required' and 'no-value' classes */
[data-test-id="mandatoryFieldParent"].required.no-value

/* Also applies to: */
url-input.required.no-value
div._ngcontent-awn-VIDEO-114.required.no-value
div[mandatoryfield].required.no-value
```

### Input Validation Error State
```css
input[aria-invalid="true"]
/* Note: default state is aria-invalid="false" — flip indicates error */
```

### Button Disabled
```css
material-button.is-disabled[aria-disabled="true"][disabled]
/* tabindex="-1" on disabled buttons */
```

### Confirm button disabled (no asset selected)
```css
material-button.confirm-button.is-disabled[data-test-id="confirm-button"]
```

### Disconnected Dialog (non-fatal, auto-recovers)
```css
h2.heartbeat-dialog-header  /* "You got disconnected" */
material-button.continue-button  /* click to reconnect */
```

### Ad Blocker Detected
```css
div.ad-blocker-detected-inner-warning[role="dialog"]
h1  /* "Turn off ad blockers" */
```
**Critical:** This dialog will block ALL interactions. Must be dismissed or resolved before any form filling.

### Preferences Sync Modal
```css
h1.modal-title  /* "Preferences already in sync" */
material-button[autofocus][clear-size]  /* OK button */
```
Dismiss immediately if appears.

---

## 14. IMPORTANT REMINDERS & GOTCHAS

### 🔴 BLOCKER: Ad Blocker Detection
The page renders `<h1>Turn off ad blockers</h1>` as a persistent element. This does NOT mean an active block — it's a static element in the DOM always present. Only act on it if `div.ad-blocker-detected-inner-warning[role="dialog"]` is VISIBLE (check `display` / `visibility`).

### 🔴 BLOCKER: All IDs Are Dynamic
Never use `id` attributes in selectors. All IDs follow the pattern `a[UUID]--0` and change every page load. The provided IDs in this document are for reference/matching context only.

### 🟡 Angular Component Suffix Changes
`_ngcontent-awn-VIDEO-*` numbers like `-22`, `-53`, `-76` may increment between Google Ads versions. Never rely on the full class string. Use `aria-label`, `role`, `data-test-id`, and `debugid` as stable anchors.

### 🟡 Single Page — All Sections Live in DOM
All accordion sections (campaign settings + ad group + ad) are in the DOM simultaneously, even if visually collapsed. `querySelector` will match collapsed fields. Always check if the section accordion is `aria-expanded="true"` before filling. Click the header to expand if needed.

### 🟡 Duplicate aria-labels (Headline, Description, etc.)
Multiple ads can exist. `input[aria-label="Headline"]` may match multiple elements. Always scope to the correct ad section: look for the `h2` with "Ad 1" immediately before the target input in DOM order, or use closest-parent filtering.

### 🟡 Asset Picker Confirm Button — Wait Loop Required
```
while (confirmButton.getAttribute('aria-disabled') === 'true') {
  // wait / select more assets
}
```
Clicking `data-test-id="confirm-button"` while disabled does nothing.

### 🟡 Combobox Dropdowns — Do NOT Press Enter
Google Ads comboboxes require clicking the option from the dropdown list. Pressing Enter may submit the form or select incorrectly. Always: type → wait for dropdown → click option.

### 🟡 Color Fields — Use Text Input Only
`input[aria-label="Main color"]` is a combobox text field. Do NOT attempt to use `input.native-color-picker[type="color"]` — it is `aria-hidden="true"` and detached from the visible UI.

### 🟡 File Upload — Use Input Element Directly
Google Ads uses hidden `<input type="file">` elements. Trigger upload by setting `.files` via `DataTransfer` and dispatching a `change` event. Do NOT simulate drag-drop unless absolutely necessary.

### 🟡 Campaign Name in Header vs Sidebar
The breadcrumb button `material-button[aria-label^="Manage campaign:"]` shows the live campaign name. Use this to verify the campaign name was saved correctly.

### 🟡 Audience Edit Opens Different Component
When editing audience (Page 4), the Angular component switches to `_ngcontent-dng-6`. The audience name input has a different class and structure. Use `aria-label="An input that edits the name of the audience"` as the stable identifier.

### 🟡 Budget Section Radios — Purpose Not Labeled
The two `mdc-radio__native-control` inputs in `name="radio-group-a07FE87D2..."` have no visible `aria-label`. Based on position: first = "Optimize daily spend" / second = "Fixed daily budget" (or similar). Default: second is selected (`aria-checked="true"`). Do not change without knowing the label text from a screenshot.

### 🟡 Review Panel — Not a Separate Page
`h2` "Review your campaign" is always in the DOM (right column). It is NOT a separate step. Publication happens via the save/publish button (not visible in provided HTML — likely at page bottom or in the review column).

### 🟡 mdc-text-field__input "Name" Fields
Seven `input.mdc-text-field__input[aria-label="Name"]` fields exist. These are for renaming assets in the asset library modal, NOT for the campaign/ad group/ad names. Do not confuse with `input[aria-label="Campaign name"]`.

### 🟡 Disconnected Dialog
```css
material-button.continue-button  /* "Continue" — reconnects session */
```
If `h2.heartbeat-dialog-header` is visible, click the continue button before proceeding with any form interaction.

### 🟡 Start/Save Flow Sequence
Recommended fill order for Demand Gen:
1. Page B: Select objective (LEADS / SALES / etc.) → Select "Demand Gen" card → Agree and continue
2. Page C: Campaign name → Campaign goal → Budget amount → Budget dates
3. Ad Group name → Location → Language
4. Ad name → Final URL → Headline → Description → Business name
5. Open image picker → upload/select landscape images → confirm
6. Open logo picker → upload/select logo → confirm
7. Verify all `[data-test-id="mandatoryFieldParent"]` elements have class `.has-value`
8. Click save/publish button