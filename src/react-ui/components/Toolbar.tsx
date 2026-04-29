import type { IInventoryWriter } from "../../_boundary/interfaces";
import type { UIMode } from "../../view/UIState";
import { useFrameTick } from "../hooks/useFrameTick";
import { ItemIcon } from "./ItemIcon";

export interface ToolbarProps {
    inventory: IInventoryWriter;
    mode: UIMode;
}

export function Toolbar({ inventory, mode }: ToolbarProps) {
    // normal モードのみフルに表示。それ以外は非表示。
    const visible = mode === "normal";
    useFrameTick(visible);

    const slots = inventory.toolbarSlots;
    const selectedIndex = inventory.selectedIndex;

    return (
        <div className={`sg-toolbar${visible ? "" : " is-hidden"}`}>
            {slots.map((stack, i) => (
                <div
                    key={i}
                    className={`sg-toolbar-slot${i === selectedIndex ? " is-selected" : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        inventory.selectSlot(i);
                    }}
                >
                    {stack && <ItemIcon itemId={stack.itemId} size={42} />}
                    {stack && stack.count >= 2 && <span className="sg-slot-count">{stack.count}</span>}
                </div>
            ))}
        </div>
    );
}
