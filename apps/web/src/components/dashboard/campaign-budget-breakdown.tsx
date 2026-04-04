import {
  Wallet,
  BarChart3,
  Brain,
  TrendingUp,
  ShieldCheck,
  Clock,
  Target,
  Eye,
  MousePointerClick,
  DollarSign,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BudgetBreakdownProps {
  campaign: {
    dailyBudget: number | null;
    totalBudget: number | null;
    spend: number;
    revenue: number;
    currency: string;
    objective: string | null;
    type: string;
    status: string;
    createdAt: Date;
    platform?: string | null;
  };
  adGroups: Array<{
    name: string;
    dailyBudget: number | null;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
  workspaceConfig: {
    monthlyBudget: number | null;
    targetCac: number | null;
    targetRoas: number | null;
    currency: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isFinite(n) && !Number.isInteger(n)) return n.toFixed(2);
  return n.toString();
}

function pct(part: number, whole: number): number {
  if (!whole || whole === 0) return 0;
  return Math.min((part / whole) * 100, 100);
}

function safeDivide(a: number, b: number): number {
  if (!b || b === 0) return 0;
  return a / b;
}

/* ------------------------------------------------------------------ */
/*  Platform display names                                             */
/* ------------------------------------------------------------------ */

const platformNames: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok Ads",
  reddit: "Reddit Ads",
  linkedin: "LinkedIn Ads",
  x: "X Ads",
};

function getPlatformName(platform?: string | null): string {
  if (!platform) return "The ad platform";
  return platformNames[platform] || platform;
}

/* ------------------------------------------------------------------ */
/*  Bidding strategy resolver                                          */
/* ------------------------------------------------------------------ */

interface BiddingStrategy {
  name: string;
  explanation: string;
  icon: React.ReactNode;
  targetLabel: string | null;
  targetValue: string | null;
}

function resolveBiddingStrategy(
  objective: string | null,
  workspaceConfig: BudgetBreakdownProps["workspaceConfig"],
  currency: string,
  platform?: string | null
): BiddingStrategy {
  const pName = getPlatformName(platform);

  if (workspaceConfig?.targetRoas && workspaceConfig.targetRoas > 0) {
    return {
      name: "Target ROAS",
      explanation:
        `${pName} optimizes bids to achieve your target return on ad spend, prioritizing high-value conversions.`,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      targetLabel: "Target ROAS",
      targetValue: `${(workspaceConfig.targetRoas * 100).toFixed(0)}%`,
    };
  }

  if (workspaceConfig?.targetCac && workspaceConfig.targetCac > 0) {
    return {
      name: "Target CPA",
      explanation:
        `${pName} sets bids to get as many conversions as possible at or below your target cost per acquisition.`,
      icon: <Target className="w-3.5 h-3.5" />,
      targetLabel: "Target CPA",
      targetValue: formatCurrency(workspaceConfig.targetCac, currency),
    };
  }

  const obj = (objective || "").toLowerCase();

  if (obj.includes("conversion")) {
    return {
      name: "Maximize Conversions",
      explanation:
        `${pName} automatically sets bids to help get the most conversions within your budget.`,
      icon: <Target className="w-3.5 h-3.5" />,
      targetLabel: null,
      targetValue: null,
    };
  }
  if (obj.includes("traffic") || obj.includes("click")) {
    return {
      name: "Maximize Clicks",
      explanation:
        `${pName} sets bids to get as many clicks as possible within your daily budget.`,
      icon: <MousePointerClick className="w-3.5 h-3.5" />,
      targetLabel: null,
      targetValue: null,
    };
  }
  if (obj.includes("awareness") || obj.includes("reach") || obj.includes("impression")) {
    return {
      name: "Target Impression Share",
      explanation:
        `${pName} bids to show your ads for maximum visibility and reach.`,
      icon: <Eye className="w-3.5 h-3.5" />,
      targetLabel: null,
      targetValue: null,
    };
  }
  if (obj.includes("sale") || obj.includes("revenue") || obj.includes("value")) {
    return {
      name: "Maximize Conversion Value",
      explanation:
        `${pName} optimizes bids to generate the highest total conversion value within your budget.`,
      icon: <DollarSign className="w-3.5 h-3.5" />,
      targetLabel: null,
      targetValue: null,
    };
  }

  return {
    name: "Maximize Conversions",
    explanation:
      `${pName} automatically sets bids to help get the most conversions within your budget.`,
    icon: <Target className="w-3.5 h-3.5" />,
    targetLabel: null,
    targetValue: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-accent">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </span>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const width = Math.min(pct(value, max), 100);
  return (
    <div className={`h-1.5 bg-subtle w-full ${className ?? ""}`}>
      <div
        className="h-full bg-accent/60 transition-all duration-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </span>
      <span
        className={
          highlight ? "text-lg text-accent font-bold" : "text-lg text-text font-bold"
        }
      >
        {value}
      </span>
      {sub && <span className="text-xs text-text">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CampaignBudgetBreakdown({
  campaign,
  adGroups,
  workspaceConfig,
}: BudgetBreakdownProps) {
  const cur = campaign.currency || workspaceConfig?.currency || "USD";
  const daily = campaign.dailyBudget ?? 0;
  const total = campaign.totalBudget ?? 0;
  const spend = campaign.spend;
  const revenue = campaign.revenue;
  const roas = safeDivide(revenue, spend);
  const remaining = Math.max(total - spend, 0);
  const daysRemaining = daily > 0 ? Math.ceil(remaining / daily) : null;
  const totalAdGroupSpend = adGroups.reduce((s, g) => s + g.spend, 0);

  const strategy = resolveBiddingStrategy(campaign.objective, workspaceConfig, cur, campaign.platform);
  const pName = getPlatformName(campaign.platform);

  const projectedMonthly = daily * 30;
  const pctOfWorkspaceBudget =
    workspaceConfig?.monthlyBudget && workspaceConfig.monthlyBudget > 0
      ? pct(projectedMonthly, workspaceConfig.monthlyBudget)
      : null;

  const daysSinceLaunch = Math.max(
    1,
    Math.ceil(
      (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const dailyRunRate = spend / daysSinceLaunch;
  const projectedTotalCost =
    total > 0 && dailyRunRate > 0 ? total : dailyRunRate * 30;

  const headroom =
    workspaceConfig?.monthlyBudget && workspaceConfig.monthlyBudget > 0
      ? workspaceConfig.monthlyBudget - projectedMonthly
      : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ============================================================ */}
      {/*  1. BUDGET OVERVIEW                                           */}
      {/* ============================================================ */}
      <div className="card p-5">
        <SectionHeader icon={<Wallet className="w-4 h-4" />} label="Budget Overview" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Daily Budget */}
          <StatCell
            label="Daily Budget"
            value={daily > 0 ? formatCurrency(daily, cur) : "—"}
            sub={daily > 0 ? "Per day cap" : "Not set"}
          />

          {/* Total Budget + progress */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
              Total Budget
            </span>
            <span className="text-lg text-text font-bold">
              {total > 0 ? formatCurrency(total, cur) : "—"}
            </span>
            {total > 0 && (
              <>
                <ProgressBar value={spend} max={total} className="mt-1" />
                <span className="text-xs text-text">
                  {formatCurrency(spend, cur)} spent &middot;{" "}
                  {pct(spend, total).toFixed(1)}% used
                </span>
              </>
            )}
            {total === 0 && (
              <span className="text-xs text-text">No lifetime cap</span>
            )}
          </div>

          {/* Days Remaining */}
          <StatCell
            label="Days Remaining"
            value={
              daysRemaining !== null ? `${formatNumber(daysRemaining)}d` : "—"
            }
            sub={
              daysRemaining !== null ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-text-secondary" />
                  At current daily rate
                </span>
              ) : (
                "Requires daily + total budget"
              )
            }
          />

          {/* Campaign ROAS */}
          <StatCell
            label="Campaign ROAS"
            value={spend > 0 ? `${roas.toFixed(2)}x` : "—"}
            highlight={roas >= 1}
            sub={
              spend > 0
                ? `${formatCurrency(revenue, cur)} rev / ${formatCurrency(spend, cur)} spend`
                : "No spend data yet"
            }
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/*  2. AD GROUP ALLOCATION                                       */}
      {/* ============================================================ */}
      <div className="card p-5">
        <SectionHeader
          icon={<BarChart3 className="w-4 h-4" />}
          label="Ad Group Allocation"
        />

        <p className="text-xs text-text-secondary mb-4 leading-relaxed max-w-2xl">
          {pName}&apos;s algorithm automatically distributes your daily budget across ad
          groups based on real-time performance. Higher-performing groups receive
          more budget throughout the day.
        </p>

        {adGroups.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-text-secondary py-4">
            <Info className="w-3.5 h-3.5" />
            No ad groups configured for this campaign.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {adGroups.map((group) => {
            const groupPct = pct(group.spend, totalAdGroupSpend);
            const cpc = safeDivide(group.spend, group.clicks);
            const cpa = safeDivide(group.spend, group.conversions);
            const hasSpend = group.spend > 0;

            return (
              <div
                key={group.name}
                className="border border-divider bg-transparent p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text font-medium">
                    {group.name}
                  </span>
                  {hasSpend ? (
                    <span className="text-sm text-accent font-bold">
                      {formatCurrency(group.spend, cur)}
                    </span>
                  ) : (
                    <span className="badge text-[10px]">Pending</span>
                  )}
                </div>

                {hasSpend ? (
                  <>
                    <ProgressBar value={group.spend} max={totalAdGroupSpend} />
                    <div className="flex items-center gap-4 mt-2 text-xs text-text">
                      <span>
                        {groupPct.toFixed(1)}% of total spend
                      </span>
                      <span className="text-text/10">|</span>
                      <span>
                        CPC{" "}
                        <span className="text-text font-medium">
                          {formatCurrency(cpc, cur)}
                        </span>
                      </span>
                      <span className="text-text/10">|</span>
                      <span>
                        CPA{" "}
                        <span className="text-text font-medium">
                          {group.conversions > 0
                            ? formatCurrency(cpa, cur)
                            : "—"}
                        </span>
                      </span>
                      <span className="text-text/10">|</span>
                      <span>
                        {formatNumber(group.impressions)} impr
                      </span>
                      <span className="text-text/10">|</span>
                      <span>
                        {formatNumber(group.clicks)} clicks
                      </span>
                      <span className="text-text/10">|</span>
                      <span>
                        {formatNumber(group.conversions)} conv
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-secondary mt-1">
                    Pending — allocation begins after launch
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  3. BIDDING STRATEGY                                          */}
      {/* ============================================================ */}
      <div className="card p-5">
        <SectionHeader
          icon={<Brain className="w-4 h-4" />}
          label="Bidding Strategy"
        />

        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-accent/10 text-accent shrink-0">
            {strategy.icon}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-text font-bold">
                {strategy.name}
              </span>
              <span className="badge text-[10px]">Smart Bidding</span>
            </div>

            <p className="text-xs text-text leading-relaxed max-w-xl">
              {strategy.explanation}
            </p>

            {strategy.targetLabel && strategy.targetValue && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                  {strategy.targetLabel}
                </span>
                <span className="text-sm text-accent font-bold">
                  {strategy.targetValue}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  4. SPEND PROJECTIONS                                         */}
      {/* ============================================================ */}
      <div className="card p-5">
        <SectionHeader
          icon={<TrendingUp className="w-4 h-4" />}
          label="Spend Projections"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Projected Monthly */}
          <StatCell
            label="Projected Monthly Spend"
            value={daily > 0 ? formatCurrency(projectedMonthly, cur) : "—"}
            sub={
              daily > 0
                ? `${formatCurrency(daily, cur)} x 30 days`
                : "Requires daily budget"
            }
          />

          {/* % of workspace budget */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
              Workspace Budget Share
            </span>
            <span
              className={`text-lg font-bold ${
                pctOfWorkspaceBudget !== null && pctOfWorkspaceBudget > 80
                  ? "text-amber-400"
                  : "text-text"
              }`}
            >
              {pctOfWorkspaceBudget !== null
                ? `${pctOfWorkspaceBudget.toFixed(1)}%`
                : "—"}
            </span>
            {pctOfWorkspaceBudget !== null && (
              <ProgressBar
                value={projectedMonthly}
                max={workspaceConfig!.monthlyBudget!}
                className="mt-1"
              />
            )}
            <span className="text-xs text-text">
              {workspaceConfig?.monthlyBudget
                ? `of ${formatCurrency(workspaceConfig.monthlyBudget, cur)} monthly`
                : "No workspace budget set"}
            </span>
          </div>

          {/* Budget exhaustion */}
          <StatCell
            label="Budget Exhaustion"
            value={
              daysRemaining !== null ? `${formatNumber(daysRemaining)} days` : "—"
            }
            sub={
              daysRemaining !== null && daysRemaining <= 7 ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Running low
                </span>
              ) : total > 0 ? (
                `${formatCurrency(remaining, cur)} remaining`
              ) : (
                "No lifetime cap set"
              )
            }
          />

          {/* Projected total */}
          <StatCell
            label="Projected Total Cost"
            value={
              dailyRunRate > 0
                ? formatCurrency(projectedTotalCost, cur)
                : "—"
            }
            sub={
              dailyRunRate > 0
                ? `${formatCurrency(dailyRunRate, cur)}/day avg over ${daysSinceLaunch}d`
                : "No spend history"
            }
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/*  5. COST CONTROLS & SAFETY                                    */}
      {/* ============================================================ */}
      <div className="card p-5">
        <SectionHeader
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Cost Controls & Safety"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Daily cap */}
          <div className="border border-divider bg-transparent p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
              Daily Spending Cap
            </span>
            <span className="text-sm text-text font-bold">
              {daily > 0 ? formatCurrency(daily, cur) : "Not set"}
            </span>
            {daily > 0 && campaign.platform === "google" && (
              <span className="text-xs text-text-secondary">
                Max{" "}
                <span className="text-text">
                  {formatCurrency(daily * 2, cur)}
                </span>{" "}
                on high-opportunity days
              </span>
            )}
          </div>

          {/* Total cap */}
          <div className="border border-divider bg-transparent p-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
              Lifetime Spending Cap
            </span>
            <span className="text-sm text-text font-bold">
              {total > 0 ? formatCurrency(total, cur) : "Not set"}
            </span>
            {total > 0 && (
              <span className="text-xs text-text-secondary">
                Campaign pauses automatically at cap
              </span>
            )}
          </div>

          {/* Platform budget flexibility note */}
          <div className="border border-amber-500/10 bg-amber-500/[0.03] p-4 flex gap-3 items-start md:col-span-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-amber-300 font-medium">
                Daily budget flexibility
              </span>
              <span className="text-xs text-text-secondary leading-relaxed">
                {campaign.platform === "google"
                  ? "Google may spend up to 2x your daily budget on high-opportunity days, but your monthly average stays at your target. Over a 30-day billing period, you won't be charged more than your daily budget × 30.4."
                  : `${pName} may adjust daily spending based on performance opportunities. Your overall budget cap is respected over the billing period.`}
              </span>
            </div>
          </div>

          {/* Workspace headroom */}
          {workspaceConfig?.monthlyBudget && workspaceConfig.monthlyBudget > 0 && (
            <div className="border border-divider bg-transparent p-4 flex flex-col gap-1 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                Workspace Monthly Headroom
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-sm font-bold ${
                    headroom !== null && headroom < 0
                      ? "text-red-400"
                      : "text-accent"
                  }`}
                >
                  {headroom !== null ? formatCurrency(headroom, cur) : "—"}
                </span>
                <span className="text-xs text-text-secondary">
                  remaining after this campaign&apos;s projected monthly spend
                </span>
              </div>
              {headroom !== null && headroom < 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  This campaign exceeds your workspace monthly budget
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
