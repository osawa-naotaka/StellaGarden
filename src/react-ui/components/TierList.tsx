import type { TierProgress } from "../../_boundary/interfaces";
import { getItemDef } from "../../_registry/ItemRegistry";
import { ItemIcon } from "./ItemIcon";
import { ProgressBar } from "./ProgressBar";

const STATUS_MARK: Record<TierProgress["status"], string> = {
    unlocked: "✓",
    in_progress: "▶",
    locked: "🔒",
};

function TierCard({ progress }: { progress: TierProgress }) {
    const { tier, status, cumulativeShipped, threshold } = progress;
    const sourceLabel = tier.unlock ? getItemDef(tier.unlock.sourceItemId)?.displayName ?? "?" : null;

    return (
        <div className={`sg-tier-card sg-tier-card--${status === "in_progress" ? "in-progress" : status}`}>
            <span className={`sg-tier-mark sg-tier-mark--${status === "in_progress" ? "in-progress" : status}`}>
                {STATUS_MARK[status]}
            </span>
            <div className="sg-tier-info">
                <div className="sg-tier-label">
                    {tier.label}
                    {tier.isGoal ? " ★" : ""}
                </div>
                <div className="sg-tier-detail">
                    {status === "unlocked" && (tier.unlock ? `released (${cumulativeShipped} shipped)` : "released")}
                    {status === "in_progress" && `${sourceLabel} ${cumulativeShipped}/${threshold}`}
                    {status === "locked" && tier.unlock && `${sourceLabel} ${tier.unlock.threshold}`}
                </div>
                {status === "in_progress" && <ProgressBar value={cumulativeShipped} max={threshold} />}
            </div>
            <div className="sg-tier-icon">
                <ItemIcon itemId={tier.itemId} size={28} />
            </div>
        </div>
    );
}

export function TierList({ tiers }: { tiers: readonly TierProgress[] }) {
    // displayRow ごとにグループ化
    const rowsByDisplayRow = new Map<number, TierProgress[]>();
    for (const t of tiers) {
        const r = t.tier.displayRow;
        const list = rowsByDisplayRow.get(r) ?? [];
        list.push(t);
        rowsByDisplayRow.set(r, list);
    }
    const sortedRows = Array.from(rowsByDisplayRow.entries()).sort((a, b) => a[0] - b[0]);

    return (
        <div className="sg-tier-list">
            {sortedRows.map(([row, items]) => (
                <div key={row} className={`sg-tier-row${items.length === 1 ? " sg-tier-row--single" : ""}`}>
                    {items.map((t) => (
                        <TierCard key={t.tier.id} progress={t} />
                    ))}
                </div>
            ))}
        </div>
    );
}
