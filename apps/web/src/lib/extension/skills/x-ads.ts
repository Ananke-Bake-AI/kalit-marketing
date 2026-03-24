/**
 * X Ads Platform Skill
 *
 * Teaches the AI agent exactly how the X Ads Manager works so it doesn't
 * have to guess form structure. This is injected into the system prompt
 * when the platform is "x".
 *
 * Built from actual HTML dumps of the X Ads Manager campaign creation flow
 * at ads.x.com (March 2026). Every field identifier, section order, and
 * interaction pattern is verified against the real DOM.
 */

export const X_ADS_SKILL = `
X ADS MANAGER — PLATFORM KNOWLEDGE (ads.x.com)

You are filling forms on X (Twitter) Ads Manager at ads.x.com. Below is the exact structure of every page, field, button, and interaction — derived from the actual HTML.

================================================================================
PAGE FLOW OVERVIEW
================================================================================

The campaign creation flow has 4 pages, navigated via footer buttons:

  Page 1: Campaign Details
    URL pattern: /campaign_form/{account_id}/campaign/...
    Footer: [Exit] [Save draft] [Next]

  Page 2: Ad Group Details (biggest page — targeting, budget, delivery)
    URL pattern: /campaign_form/{account_id}/campaign/adgroup/0/adgroup_details
    Footer: [Back] [Save draft] [Next]

  Page 3: Creative / Ad (tweet compose + media + destination)
    URL pattern: /campaign_form/{account_id}/campaign/adgroup/0/creative_form/0
    Footer: [Back] [Save draft] [Next]

  Page 4: Review & Launch
    URL pattern: /campaign_form/{account_id}/campaign/review
    Footer: [Back] [Save draft] [Launch campaign]

LEFT SIDEBAR NAVIGATION:
  The sidebar shows the campaign tree structure:
  - "Campaign" section → "Campaign details" (button)
  - "Ad groups" section → ad group name (expandable, contains "Ad group details" + "Ad 1")
  - "Review" section → "Review and launch campaign" (button)
  Sidebar item data-test-id-v2="AdGroupNavigationSidebar-adGroupNavigationSidebar"

================================================================================
PAGE 1: CAMPAIGN DETAILS
================================================================================

Section: "Campaign details" (data-module-id="campaign_details")

FIELDS (top to bottom):

1. OBJECTIVE (read-only display + edit button)
   - Shows current objective as bold text
   - data-test-id-v2="CampaignObjective-objectiveField" (the <strong> showing value, e.g. "Reach")
   - data-test-id-v2="CampaignObjective-editButton" (button to change objective)
   - Available objectives: Reach, Engagements, Video views, App installs, Website traffic,
     Followers, App re-engagements, Pre-roll views
   - Default: "Reach" with description "Maximize your ad's reach"
   - IMPORTANT: Clicking "Edit" opens an objective selector. Only change if campaign data specifies.

2. CAMPAIGN NAME
   - <input> with data-test-id-v2="CampaignName-campaignNameField"
   - placeholder="Untitled"
   - type="text"
   - Max 255 characters (counter shows "Characters left: X")
   - OVERWRITE with campaign name from campaign data

3. FUNDING SOURCE (read-only)
   - <input> with data-test-id-v2="CampaignFunding-fundingInstrumentDropdown"
   - readonly attribute — DO NOT try to change this
   - Shows payment method like "MasterCard ending in 1752"

4. ADVANCED SECTION (collapsed by default)
   - Toggle open by clicking <button class="FormFieldset-legend">Advanced</button>

   4a. CAMPAIGN BUDGET OPTIMIZATION (switch/toggle)
       - <div role="switch" class="Switch"> with aria-checked="false"
       - Default: Off
       - Leave off unless campaign data specifies otherwise

   4b. CAMPAIGN SPEND CAP
       - <input> with placeholder="0.00"
       - aria-labelledby points to label "Campaign spend cap"
       - Has currency prefix "EUR" (or account currency) as FormInputWrapper-startAdornment
       - Leave empty unless campaign data specifies a campaign-level cap

FOOTER BUTTONS:
  - "Exit" — leaves the form (link style button)
  - "Save draft" — saves without advancing (border/outline style)
  - "Next" — advances to Page 2 (solid black button)

================================================================================
PAGE 2: AD GROUP DETAILS
================================================================================

This is the largest page with many sections. Sections appear in this exact order:

---------- SECTION: "Ad group details" (data-module-id) ----------

1. AD GROUP NAME
   - <input> with data-test-id-v2="AdGroupName-input"
   - placeholder="Untitled"
   - type="text"
   - FILL with ad group name from campaign data

---------- SECTION: "Budget & Schedule" ----------

2. DAILY AD GROUP BUDGET
   - <input> with placeholder="0.00"
   - NO data-test-id-v2 (the daily budget input lacks a unique test ID!)
   - aria-labelledby points to label "Daily ad group budget"
   - type="text"
   - Pre-filled with a default (e.g. "86.41") — OVERWRITE with campaign dailyBudget
   - Has currency prefix as startAdornment
   - IDENTIFICATION: This is the FIRST numeric input after "Ad group name" field.
     Its label text is "Daily ad group budget".

3. TOTAL SPEND
   - <input> with data-test-id-v2="AdGroupBudget-totalBudgetInput"
   - placeholder="0.00"
   - type="text"
   - Usually empty by default
   - FILL with campaign totalBudget
   - Has currency prefix as startAdornment

4. START DATE & TIME
   - Date: Button showing date like "3/24/26" inside div with
     data-test-id-v2="AdGroupStartDate-dateDropdown"
     Clicking opens a date picker
   - Time: <input> with data-test-id-v2="AdGroupStartDate-timePicker"
     value like "4:05pm"
   - Timezone: <div> with data-test-id-v2="AdGroupStartDate-timezone"
   - DEFAULT: Leave as-is (starts immediately) unless campaign specifies

5. END DATE (optional)
   - Label "End" — usually not set for drafts
   - Leave empty unless campaign specifies an end date

---------- SECTION: "Delivery" ----------

6. GOAL (dropdown)
   - <input> with data-test-id-v2="goalDropdown"
   - Shows current value like "Max reach"
   - Clicking opens a dropdown with goal options
   - Leave as default unless campaign specifies

7. BID STRATEGY (radio tile group)
   Three options as tile radio buttons:
   - data-test-id-v2="BidStrategySelect-AUTO" (auto-bid, recommended, selected by default)
   - data-test-id-v2="BidStrategySelect-TARGET" (target cost)
   - data-test-id-v2="BidStrategySelect-MAX" (maximum bid)
   Each is a <div> with role="radio" and aria-checked="true"/"false"
   Leave as AUTO unless campaign specifies

8. PAY BY (dropdown)
   - <input> with data-test-id-v2="payByDropdown"
   - Shows "Impression" by default
   - Clicking opens dropdown
   - Leave as default

9. FREQUENCY CAP (radio group)
   - data-test-id-v2="frequencyCapOptions"
   - Two options (radio buttons):
     a. "Automatically optimize ad frequency (recommended)" — value="no_range", checked by default
     b. Custom frequency cap — value="range"
   - Leave as default (auto)

10. PACING (radio group)
    - data-test-id-v2="AdGroupStandardDelivery-radioSelect"
    - Two options:
      a. "Standard (recommended)" — value="standard", checked by default
      b. "Accelerated" — value="accelerated"
    - Leave as default (standard)

11. MEASUREMENT OPTIONS (collapsed fieldset)
    - Click <button class="FormFieldset-legend">Measurement options</button> to expand

    11a. APP CONVERSIONS
         - data-test-id-v2="AppDropdownField-appDropdownField"
         - Button "Choose an Android app" — opens app selector dropdown
         - Skip unless campaign requires

    11b. AUDIENCE MEASUREMENT TAG
         - <input> with data-test-id-v2="audienceMeasurementTagsFormSelector"
         - May show "There are no partners to select."
         - Skip

    11c. GOOGLE CAMPAIGN MANAGER IMPRESSION TAG
         - <input> with data-test-id-v2="impressionTagSelector"
         - placeholder="https://ad.doubleclick.net/ddm/trackimp"
         - Skip unless campaign provides

    11d. GOOGLE CAMPAIGN MANAGER CLICK TAG
         - <input> with data-test-id-v2="clickTrackerSelector"
         - placeholder="https://ad.doubleclick.net/ddm/trackclk"
         - Skip unless campaign provides

---------- SECTION: "Placements" ----------

12. PLACEMENT CHECKBOXES
    All have data-test-id-v2="Placements-placementCheckbox"
    Identified by their name attribute and value:

    a. "Home timelines" — value="TWITTER_TIMELINE" (checked, DISABLED — always on)
    b. "Profiles" — value="TWITTER_PROFILE" (checked by default)
    c. "Search results" — value="TWITTER_SEARCH" (checked by default)
    d. "Replies" — value="TWITTER_REPLIES" (checked by default)

    Also has: "Brand safety controls" button (opens separate controls)
    Leave all checked unless campaign specifies

---------- SECTION: "Demographics" ----------

13. GENDER (button group)
    Three buttons:
    - data-test-id-v2="AdGroupGender-anyButton" — text "Any" (selected by default, class includes "is-selected")
    - data-test-id-v2="AdGroupGender-femaleButton" — text "Women"
    - data-test-id-v2="AdGroupGender-maleButton" — text "Men"
    Click the appropriate button to select

14. AGE (radio group)
    - data-test-id-v2="Age-targetingModeOption"
    Two radio options:
    a. "All" — value="all_ages" (checked by default)
    b. "Age range" — value="age_range" (when selected, shows min/max dropdowns)
    Leave as "All" unless campaign specifies age range

15. LANGUAGE (search input)
    - data-test-id-v2="targeting_criteria_language-input"
    - placeholder="Search"
    - Parent container: data-test-id-v2="LanguageFormField-languageFormField"
    - Type language name, wait for dropdown, click match
    - Skip unless campaign specifies languages

16. LOCATION (search input with include/exclude toggle)
    - <input> with data-test-id-v2="targeting_criteria_location-input"
    - placeholder="Search"
    - Has an "Include" / "Exclude" toggle button BEFORE the input
      (button with class "FormInputWrapper-startAdornment" and Icon--caretDown)
    - Tokens appear in data-test-id-v2="CriteriaTokens-include"
    - Has "Bulk upload" button (class "Button Button--link")
    - HOW TO ADD LOCATIONS:
      1. Click the input field
      2. Type the FULL location name (e.g. "France", "United States", "London")
      3. Wait for dropdown suggestions to appear
      4. Click the matching result
      5. The location appears as a token (data-test-id-v2="token")
      6. Repeat for each location — ONE AT A TIME
    - Use full country/city names, not codes

---------- SECTION: "Devices" ----------

17. OPERATING SYSTEM (checkboxes)
    Four checkboxes, all unchecked by default:
    - data-test-id-v2="OSType-iOS" — name="Ostype" value="0"
    - data-test-id-v2="OSType-Android" — name="Ostype" value="1"
    - data-test-id-v2="OSType-Other mobile" — name="Ostype" value="3"
    - data-test-id-v2="OSType-Desktop" — name="Ostype" value="4"
    Leave unchecked (targets all) unless campaign specifies

18. DEVICE MODEL (search input)
    - data-test-id-v2="targeting_criteria_device-input"
    - placeholder="Search"
    - Skip unless campaign specifies

19. CARRIER (search input)
    - data-test-id-v2="targeting_criteria_network_operator-input"
    - placeholder="Search"
    - Skip unless campaign specifies

---------- SECTION: "Audiences" ----------

20. CUSTOM AUDIENCES (search input with include/exclude toggle)
    - <input> with data-test-id-v2="targeting_criteria_custom_audience-input"
    - placeholder="Search"
    - Has Include/Exclude toggle (same pattern as Location)
    - data-test-id-v2="CustomAudienceExpansion-checkbox" — "Also target users similar to your audience"
    - Skip unless campaign specifies custom audiences

---------- SECTION: "Targeting features" ----------

21. KEYWORDS (search input with include/exclude toggle)
    - <input> with data-test-id-v2="targeting_criteria_keyword-input"
    - placeholder="Search"
    - Has Include/Exclude toggle button
    - Has "Bulk upload" button
    - HOW TO ADD KEYWORDS:
      1. Click the input
      2. Type a keyword or phrase
      3. Press Enter or click a suggestion from the dropdown
      4. Repeat for each keyword — ONE AT A TIME
    - Keywords target users who tweeted/searched/engaged with those terms

22. FOLLOWER LOOK-ALIKES (search input)
    - <input> with data-test-id-v2="targeting_criteria_similar_to_followers_of_user-input"
    - placeholder="Search"
    - Has "Bulk upload" button
    - HOW TO ADD: Type @handle or account name, wait for dropdown, click match
    - Targets users similar to followers of those accounts

23. INTERESTS (search input)
    - <input> with data-test-id-v2="targeting_criteria_interest-input"
    - placeholder="Search"
    - HOW TO ADD: Type interest topic, wait for dropdown, click matching category
    - One at a time

24. MOVIES AND TV SHOWS (search input)
    - <input> with data-test-id-v2="targeting_criteria_tv_show-input"
    - placeholder="Search"
    - Skip unless campaign specifies

25. CONVERSATION TOPICS (search input)
    - <input> with data-test-id-v2="targeting_criteria_conversation-input"
    - placeholder="Search"
    - Skip unless campaign specifies

26. ADDITIONAL OPTIONS (collapsed fieldset)
    - data-test-id-v2="TargetingFeatures-additionalOptionsFieldset"
    - Click "Additional options" button to expand
    - Contains:
      a. ENGAGER RETARGETING checkbox
         data-test-id-v2="engager-targeting"
         Label: "Retarget people who saw or engaged with your past posts"
         Skip unless campaign specifies

---------- SECTION: "Targeting strategy" ----------

27. OPTIMIZE TARGETING (switch)
    - <div> with data-test-id-v2="optimized_targeting" role="switch"
    - aria-checked="false" by default
    - Leave off unless campaign specifies

---------- SECTION: "Audience estimate" ----------

28. AUDIENCE ESTIMATE (read-only display)
    - data-test-id-v2="AudienceEstimateValue-audienceEstimateValue"
    - Shows estimated audience size — no input needed

FOOTER BUTTONS:
  - "Back" — returns to Page 1
  - "Save draft" — saves without advancing
  - "Next" — advances to Page 3

================================================================================
PAGE 3: CREATIVE / AD
================================================================================

Section: (data-module-id="creative_form")

VALIDATION CALLOUT:
  - data-test-id-v2="creative-form-validation-callout"
  - class="Callout Callout--warning"
  - Shows validation errors (e.g., missing required fields)
  - This may appear at the top of the form

SIDEBAR ACTIONS:
  - "Create another ad" button
  - "Copy ad" button
  - "Delete" button (disabled when only 1 ad)
  - "Use existing ad" button — data-test-id-v2="tweets-drawer-button"
    Opens a drawer to select an existing tweet/ad

FIELDS (top to bottom):

1. AD NAME
   - <input> with data-test-id="creativeNameInput" and id="creativeNameInput"
   - placeholder="Untitled ad (optional)"
   - maxlength="120"
   - Label: "Name" (with for="creativeNameInput")
   - Counter shows "X/120"
   - Pre-filled with "Ad 1" — can leave or overwrite

2. TWEET COMPOSE AREA (the main ad body text)
   - Container: <div data-test-id="tweetTextInput" class="TweetTextInput TweetTextInput--rich">
   - Editable: <div class="TweetTextInput-editor" contenteditable="true" aria-multiline="true">
   - Placeholder: <div class="TweetTextInput-placeholder">What's happening?</div>
     (placeholder disappears when text is entered)
   - Progress: TweetTextInput-progress (circular SVG showing character count)
   - THIS IS WHERE THE AD BODY/TWEET TEXT GOES
   - IMPORTANT: This is a contenteditable div, NOT an input or textarea
   - To fill: Click the div, then type or paste the tweet body text
   - Character limit: 280 characters (standard tweet limit)
   - DO NOT put URLs or headlines here — only the body text/copy

3. REPLY SETTINGS
   - Button showing "Only people you mention" (default for ads)
   - Usually leave as-is

4. DESTINATION (radio button group)
   - Container: data-test-id="card-type-dropdown" / data-testid="card-type-dropdown"
   - role="radiogroup"
   - Label: "Destination"
   - Two options:
     a. WEBSITE — data-test-id="card-type-dropdown-WEBSITE" / data-testid="card-type-dropdown-WEBSITE"
        role="radio" — "Website: Include a call to action to your website."
     b. APP — data-test-id="card-type-dropdown-APP" / data-testid="card-type-dropdown-APP"
        role="radio" — "App: Include a call to action to your app."
   - CLICK "Website" if campaign has a destination URL
   - Neither is selected by default (both aria-checked="false")
   - IMPORTANT: Selecting "Website" reveals the headline and URL fields below

5. MEDIA FORMAT (radio button group — appears after selecting destination)
   - Container: data-test-id="adFormatsGroup"
   - Label: "Media"
   - Two options:
     a. SINGLE MEDIA — data-test-id="adFormatsGroup-SINGLE_MEDIA" / data-testid="adFormatsGroup-SINGLE_MEDIA"
        "Single media: 1 photo or video"
     b. CAROUSEL — data-test-id="adFormatsGroup-CAROUSEL" / data-testid="adFormatsGroup-CAROUSEL"
        "Carousel" (multiple images)
   - Select based on campaign media requirements

6. MEDIA UPLOAD / SELECTION
   - Media Library search: <input> with data-test-id="mediaSearchBar"
     placeholder="Search by name"
   - Media type filter: <button> with data-test-id="mediaTypeDropdown"
     Shows "All" by default — dropdown to filter by image/video
   - File upload: <button id="feather-file-picker-cta-1463">Browse your device</button>
     with hidden <input type="file"> (class="FilePicker-callToActionFileInput")
   - Upload icon: class="FilePicker-uploadIcon"
   - The FilePicker area: class="FilePicker is-empty" (shows empty state)
   - HOW TO UPLOAD MEDIA:
     1. Click "Browse your device" button
     2. Select file from system dialog
     OR use mediaSearchBar to find existing media in library

7. PROMOTED ONLY CHECKBOX
   - data-test-id="promotedOnlyCheckbox" id="promotedOnly"
   - When checked: ad only shows as a promoted ad, not on your organic timeline
   - Checked by default (data-state="checked")

8. HEADLINE FIELD (appears after selecting Website destination)
   - This field appears when "Website" destination is selected
   - Used for the card preview headline
   - PUT the headline from creative data here

9. WEBSITE URL FIELD (appears after selecting Website destination)
   - Used for the destination/click-through URL
   - PUT the destinationUrl from creative data here

NOTE: Fields 8 and 9 (headline and URL) are conditionally rendered — they only
appear AFTER you click the "Website" destination option. The agent must:
  1. First select "Website" as destination
  2. Wait for the headline and URL fields to appear
  3. Then fill them in

FOOTER BUTTONS:
  - "Back" — returns to Page 2
  - "Cancel" / "Confirm" — may appear in media selection dialogs
  - "Save draft" — saves without advancing
  - "Next" — advances to Page 4

================================================================================
PAGE 4: REVIEW & LAUNCH
================================================================================

This page is READ-ONLY — it displays all campaign settings for review.

All review fields use this pattern:
  - Label: data-test-id-v2="CampaignReview-reviewFieldLabel-{FieldName}"
  - Value: data-test-id-v2="CampaignReview-reviewFieldValue-{FieldName}"

DISPLAYED REVIEW FIELDS:
  - Name (campaign name)
  - Objective
  - Funding source
  - Campaign Budget Optimization
  - Daily ad group budget
  - Total ad group budget
  - Start
  - End
  - Goal
  - Bid strategy
  - Pay by
  - Pacing
  - App conversions
  - X placements
  - Audience
  - Summary (audience summary text)

TARGETING DETAILS (collapsed fieldset):
  Click "Targeting details" button to expand:
  - Gender
  - Age
  - Locations
  - Optimized Targeting
  - Ads (shows ad names/count)

NO FIELDS TO FILL on this page. Just verify and proceed.

FOOTER BUTTONS:
  - "Back" — returns to Page 3
  - "Save draft" — saves as draft (does NOT launch)
  - "Launch campaign" — launches the campaign live (solid black button)
  IMPORTANT: For drafts, click "Save draft" NOT "Launch campaign"

================================================================================
FIELD IDENTIFICATION CHEAT SHEET
================================================================================

All search/targeting fields follow the same pattern:
  data-test-id-v2="targeting_criteria_{type}-input" placeholder="Search"

  Targeting types and their data-test-id-v2 values:
  - Location:          targeting_criteria_location-input
  - Language:           targeting_criteria_language-input
  - Keywords:           targeting_criteria_keyword-input
  - Follower alikes:    targeting_criteria_similar_to_followers_of_user-input
  - Interests:          targeting_criteria_interest-input
  - TV/Movies:          targeting_criteria_tv_show-input
  - Conversations:      targeting_criteria_conversation-input
  - Custom audiences:   targeting_criteria_custom_audience-input
  - Device model:       targeting_criteria_device-input
  - Carrier:            targeting_criteria_network_operator-input

All targeting search fields have:
  - placeholder="Search"
  - class="FormInput"
  - A search icon (Icon--search) as end adornment
  - Some have an Include/Exclude toggle button before the input

================================================================================
SELECT/DROPDOWN INTERACTION RULES
================================================================================

For any search/targeting field:
  1. Use "select" action type
  2. Target the field by its data-test-id-v2
  3. Type ONE value per action
  4. The extension will:
     a. Click the input to focus it
     b. Type the value
     c. Wait for dropdown suggestions to appear
     d. Click the best matching result
     e. If no dropdown match, press Enter to confirm
  5. Do ONE select at a time — never batch multiple values

For dropdown fields (goalDropdown, payByDropdown):
  1. Click the input to open the dropdown
  2. Click the desired option from the list

For button groups (gender, bid strategy):
  1. Click the specific button by its data-test-id-v2

================================================================================
BUDGET RULES
================================================================================

- dailyBudget goes in the "Daily ad group budget" field (first numeric input after ad group name)
- totalBudget goes in "Total spend" field (data-test-id-v2="AdGroupBudget-totalBudgetInput")
- dailyBudget MUST be LESS THAN totalBudget
- Use numbers only (no currency symbols — the form adds them automatically)
- OVERWRITE any pre-filled budget values (clear field first, then type new value)
- Currency prefix is shown as FormInputWrapper-startAdornment (e.g. "EUR", "USD")

================================================================================
CREATIVE PAGE RULES
================================================================================

- The tweet body text goes in the contenteditable div (class="TweetTextInput-editor")
  NOT in any <input> field
- The contenteditable div has data-test-id="tweetTextInput" on its PARENT container
- The headline goes in the headline field (appears after selecting Website destination)
- The URL goes in the website URL field (appears after selecting Website destination)
- DO NOT put URLs or headlines in the tweet body
- DO NOT put tweet body in the headline or URL fields
- Copy all text EXACTLY from campaign data — never shorten or rewrite
- Maximum tweet length: 280 characters

CREATIVE PAGE WORKFLOW:
  1. Fill the ad name (optional) via data-test-id="creativeNameInput"
  2. Click the TweetTextInput-editor div and type the tweet body text
  3. Select "Website" destination via data-test-id="card-type-dropdown-WEBSITE"
  4. Wait for headline/URL fields to render
  5. Fill headline field
  6. Fill URL field
  7. Optionally select media format and upload media
  8. Click "Next"

================================================================================
ERROR PATTERNS
================================================================================

- Validation errors appear as:
  - Callout banners: class="Callout Callout--warning" or "Callout Callout--error"
    data-test-id-v2="creative-form-validation-callout" (on creative page)
  - Field-level errors: aria-invalid="true" on the input
  - Error text: class="FormField-error" below the field
  - Character counter turns red when exceeded

- Common errors:
  - "Daily budget must be less than total budget"
  - Missing required fields on creative page (tweet text, destination)
  - Character limit exceeded (280 for tweet, 120 for ad name, 255 for campaign name)

================================================================================
CAMPAIGN OBJECTIVES REFERENCE
================================================================================

When setting the objective (Page 1), these are the available types and their effects:

| Objective         | Pricing | Goal default    | Notes                      |
|-------------------|---------|-----------------|----------------------------|
| Reach             | CPM     | Max reach       | No media restrictions       |
| Engagements       | CPE     | Engagements     | No media restrictions       |
| Video views       | CPV     | Video views     | Video/GIF required          |
| Pre-roll views    | CPV     | Pre-roll views  | Video required              |
| App installs      | CPI     | App installs    | App card required           |
| Website traffic   | CPLC    | Link clicks     | Website card required       |
| Followers         | CPF     | Followers       | Text-only recommended       |

The objective determines which fields appear on Page 2 (e.g., Website traffic
may show conversion event fields).

================================================================================
IMPORTANT REMINDERS
================================================================================

1. Ad group name comes from campaign data's ad group name, NOT the campaign name
2. "Save draft" button saves without launching — use this for draft campaigns
3. "Launch campaign" on Page 4 makes the campaign LIVE — only use if explicitly requested
4. All targeting search inputs have the SAME placeholder "Search" — identify them
   ONLY by their data-test-id-v2 attribute
5. The daily budget field lacks a unique data-test-id-v2 — identify it by its label
   "Daily ad group budget" or by being the first numeric input in Budget & Schedule
6. Contenteditable tweet editor requires click-then-type, not setValue
7. Website destination fields (headline, URL) only render AFTER clicking the
   Website radio button — you must wait for them to appear
8. Location tokens appear as chips/tags after selection — verify they appear
9. The Include/Exclude toggle on location/keywords/audiences defaults to "Include"
`;
