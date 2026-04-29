import type { MouseEvent } from "react";
import type { ItemStack } from "../../_boundary/interfaces";
import { Slot } from "./Slot";

export interface InventoryGridProps {
    rows: number;
    cols: number;
    getStack: (index: number) => ItemStack | null;
    onLeftClick: (index: number, e: MouseEvent) => void;
    onRightClick: (index: number, e: MouseEvent) => void;
}

export function InventoryGrid({ rows, cols, getStack, onLeftClick, onRightClick }: InventoryGridProps) {
    const total = rows * cols;
    const slots = [];
    for (let i = 0; i < total; i++) {
        slots.push(
            <Slot
                key={i}
                stack={getStack(i)}
                onLeftClick={(e) => onLeftClick(i, e)}
                onRightClick={(e) => onRightClick(i, e)}
            />,
        );
    }
    return (
        <div className="sg-inventory-grid" style={{ gridTemplateColumns: `repeat(${cols}, var(--sg-slot-size))` }}>
            {slots}
        </div>
    );
}
