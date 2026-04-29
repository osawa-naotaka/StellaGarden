import type { ItemStack } from "../../_boundary/interfaces";
import { ItemIcon } from "./ItemIcon";

export function CursorStack({ stack, x, y }: { stack: ItemStack | null; x: number; y: number }) {
    if (!stack) return null;
    return (
        <div className="sg-cursor-stack" style={{ left: x, top: y }}>
            <ItemIcon itemId={stack.itemId} />
            {stack.count >= 2 && <span className="sg-slot-count">{stack.count}</span>}
        </div>
    );
}
