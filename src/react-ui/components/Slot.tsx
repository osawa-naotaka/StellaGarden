import type { MouseEvent, ReactNode } from "react";
import type { ItemStack } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import { ItemIcon } from "./ItemIcon";

export interface SlotProps {
    stack: ItemStack | null;
    onLeftClick?: (e: MouseEvent) => void;
    onRightClick?: (e: MouseEvent) => void;
    children?: ReactNode;
}

export function Slot({ stack, onLeftClick, onRightClick, children }: SlotProps) {
    return (
        <div
            className="sg-slot"
            data-tooltip={stack ? getItemDisplayName(stack.itemId) : undefined}
            onClick={(e) => {
                e.stopPropagation();
                onLeftClick?.(e);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRightClick?.(e);
            }}
        >
            {stack && <ItemIcon itemId={stack.itemId} />}
            {stack && stack.count >= 2 && <span className="sg-slot-count">{stack.count}</span>}
            {children}
        </div>
    );
}
