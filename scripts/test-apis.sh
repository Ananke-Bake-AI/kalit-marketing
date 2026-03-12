#!/bin/bash
# ─── Kalit Marketing API Test Suite ───
# Tests all major API endpoints against the seeded database.
# Usage: bash scripts/test-apis.sh

BASE="http://localhost:3000/api"
PASS=0
FAIL=0

# Get workspace IDs from the API
echo "═══════════════════════════════════════════════════"
echo "  KALIT MARKETING — API TEST SUITE"
echo "═══════════════════════════════════════════════════"
echo ""

test_endpoint() {
  local method="$1"
  local url="$2"
  local label="$3"
  local body="$4"
  local expected_status="${5:-200}"

  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    status=$(curl -s -o /tmp/kalit_test_response.json -w "%{http_code}" \
      -X POST -H "Content-Type: application/json" \
      -d "$body" "$url")
  else
    status=$(curl -s -o /tmp/kalit_test_response.json -w "%{http_code}" "$url")
  fi

  if [ "$status" = "$expected_status" ]; then
    echo "  ✓ $label (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label — expected $expected_status, got $status"
    cat /tmp/kalit_test_response.json 2>/dev/null | head -3
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

# ─── 1. Workspace CRUD ───
echo "▸ Workspace CRUD"

test_endpoint GET "$BASE/workspaces" "List workspaces"

# Get workspace IDs from DB directly (avoids rtk proxy issues)
WS1=$(/opt/homebrew/opt/postgresql@16/bin/psql -U kalit -d kalit_marketing -t -A -c "SELECT id FROM workspaces WHERE name='FlowMetrics';")
WS2=$(/opt/homebrew/opt/postgresql@16/bin/psql -U kalit -d kalit_marketing -t -A -c "SELECT id FROM workspaces WHERE name='PureBlend Supplements';")
WS3=$(/opt/homebrew/opt/postgresql@16/bin/psql -U kalit -d kalit_marketing -t -A -c "SELECT id FROM workspaces WHERE name='DevHire';")

echo "  → FlowMetrics: $WS1"
echo "  → PureBlend:   $WS2"
echo "  → DevHire:     $WS3"
echo ""

test_endpoint GET "$BASE/workspaces/$WS1" "Get workspace detail (FlowMetrics)"

# Create a new workspace
SLUG="test-startup-$(date +%s)"
test_endpoint POST "$BASE/workspaces" "Create new workspace" \
  "{\"name\":\"Test Startup\",\"slug\":\"$SLUG\",\"config\":{\"productName\":\"TestApp\",\"productDescription\":\"A test product\",\"autonomyMode\":\"draft\"}}" \
  "201"

echo ""

# ─── 2. Campaigns ───
echo "▸ Campaigns"
test_endpoint GET "$BASE/workspaces/$WS1/campaigns" "List campaigns (FlowMetrics)"
test_endpoint GET "$BASE/workspaces/$WS3/campaigns" "List campaigns (DevHire)"
echo ""

# ─── 3. Tasks ───
echo "▸ Tasks"
test_endpoint GET "$BASE/workspaces/$WS1/tasks" "List tasks (FlowMetrics)"

test_endpoint POST "$BASE/workspaces/$WS1/tasks" "Create new task" \
  '{"title":"Test SEO audit","family":"research","agentType":"seo_specialist","trigger":"request","description":"Run a test SEO audit"}' \
  "201"
echo ""

# ─── 4. Events ───
echo "▸ Events"
test_endpoint GET "$BASE/workspaces/$WS1/events" "List events (FlowMetrics)"

test_endpoint POST "$BASE/events" "Ingest performance anomaly event" \
  "{\"workspaceId\":\"$WS1\",\"type\":\"performance_anomaly\",\"data\":{\"metric\":\"ctr\",\"change\":-0.35,\"campaign\":\"Test Campaign\"}}"
echo ""

# ─── 5. Growth Plan & Memory ───
echo "▸ Growth Plan & Memory"
test_endpoint GET "$BASE/workspaces/$WS1/growth-plan" "Get growth plan (none seeded)" "" "404"
test_endpoint GET "$BASE/workspaces/$WS1/memory" "Get workspace memory"
echo ""

# ─── 6. Policies ───
echo "▸ Policies"
test_endpoint GET "$BASE/workspaces/$WS1/policies" "List policies"
echo ""

# ─── 7. Lifecycle Transitions ───
echo "▸ Lifecycle"
# Reset PureBlend to producing first (in case previous run transitioned it)
/opt/homebrew/opt/postgresql@16/bin/psql -U kalit -d kalit_marketing -q -c "UPDATE workspaces SET status='producing' WHERE id='$WS2';" 2>/dev/null
test_endpoint POST "$BASE/workspaces/$WS2/transition" "Transition PureBlend (producing → awaiting_approval)" \
  '{"to":"awaiting_approval","trigger":"request","reason":"Content ready for review"}'
echo ""

# ─── 8. Platform Connect (Mock) ───
echo "▸ Platform Connect (Mock Adapters)"
test_endpoint POST "$BASE/workspaces/$WS2/connect" "Connect TikTok account" \
  '{"platform":"tiktok","accountId":"mock_tiktok_123","credentials":{"accessToken":"mock_token_tiktok"}}' \
  "201"
echo ""

# ─── 9. Sync & Measurement ───
echo "▸ Sync & Measurement"
test_endpoint POST "$BASE/workspaces/$WS1/sync" "Sync performance data (FlowMetrics)" "{}"
test_endpoint GET "$BASE/workspaces/$WS1/measurement" "Measurement confidence score"
echo ""

# ─── 10. Intelligence Layer ───
echo "▸ Intelligence Layer"
test_endpoint GET "$BASE/workspaces/$WS1/optimize" "Budget optimization analysis"
test_endpoint GET "$BASE/workspaces/$WS1/fatigue" "Creative fatigue scan"
test_endpoint GET "$BASE/workspaces/$WS1/experiments" "List experiments"
echo ""

# ─── 11. Reporting ───
echo "▸ Reporting"
test_endpoint GET "$BASE/workspaces/$WS1/reporting?start=2026-02-01&end=2026-03-10" "Growth report (FlowMetrics)"
test_endpoint GET "$BASE/workspaces/$WS3/reporting?start=2026-02-01&end=2026-03-10" "Growth report (DevHire)"
echo ""

# ─── 12. Scheduler ───
echo "▸ Scheduler"
test_endpoint GET "$BASE/cron/scheduler" "Run scheduler tick"
echo ""

# ─── Results ───
echo "═══════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠ $FAIL test(s) failed"
else
  echo "  All tests passed!"
fi
echo "═══════════════════════════════════════════════════"
