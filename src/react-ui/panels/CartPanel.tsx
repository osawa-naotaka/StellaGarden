import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, SlotRef } from "../../_boundary/interfaces";
import type { CartStorage } from "../../engine/CartStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const CART_ROWS = 4;
const CART_COLS = 4;
const CART_TOTAL = CART_ROWS * CART_COLS;
const INV_ROWS = 8;
const COLS = 8;
const TOOLBAR_COLS = 9;

type CartSlotArea = "inventory" | "toolbar" | "cart";
type CartSlotRef = { area: CartSlotArea; index: number };

export interface CartPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    cartStorage: CartStorage;
    uiState: UIState;
}

export function CartPanel({ open, inventory, cartStorage, uiState }: CartPanelProps) {
    useFrameTick(open);
    const targetCartId = uiState.targetCartId;

    const getSlot = useCallback(
        (ref: CartSlotRef): ItemStack | null => {
            if (ref.area === "cart") {
                if (targetCartId === null) return null;
                const cart = cartStorage.getByIdWritable(targetCartId);
                return cart?.inventorySlots[ref.index] ?? null;
            }
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, cartStorage, targetCartId],
    );

    const setSlot = useCallback(
        (ref: CartSlotRef, stack: ItemStack | null) => {
            if (ref.area === "cart") {
                if (targetCartId === null) return;
                const cart = cartStorage.getByIdWritable(targetCartId);
                cart?.setInventorySlot(ref.index, stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, cartStorage, targetCartId],
    );

    const getQuickTransferTargets = useCallback(
        (ref: CartSlotRef): CartSlotRef[] | undefined => {
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "cart") {
                // cart → inventory → toolbar 1..9 (hand=0 を除外)
                const targets: CartSlotRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // inventory / toolbar → cart
            if (targetCartId === null) return undefined;
            const targets: CartSlotRef[] = [];
            for (let i = 0; i < CART_TOTAL; i++) targets.push({ area: "cart", index: i });
            return targets;
        },
        [targetCartId],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<CartSlotRef>(open, {
        getSlot,
        setSlot,
        getQuickTransferTargets,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.targetCartId = null;
    }, [uiState]);

    const getCartSlot = useCallback(
        (i: number): ItemStack | null => {
            if (targetCartId === null) return null;
            const cart = cartStorage.getByIdWritable(targetCartId);
            return cart?.inventorySlots[i] ?? null;
        },
        [cartStorage, targetCartId],
    );

    return (
        <>
            <SidePanel open={open} title="Cart" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Attachment</h3>
                    {/* MVP: アタッチメントスロットは表示のみ。クリックしても何も起きない。 */}
                    <InventoryGrid rows={1} cols={1} getStack={() => null} onLeftClick={() => {}} onRightClick={() => {}} />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Cart Contents</h3>
                    <InventoryGrid
                        rows={CART_ROWS}
                        cols={CART_COLS}
                        getStack={getCartSlot}
                        onLeftClick={(i, e) => handleLeftClick({ area: "cart", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "cart", index: i })}
                    />
                </section>

                <hr className="sg-section-divider" />

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Inventory</h3>
                    <InventoryGrid
                        rows={INV_ROWS}
                        cols={COLS}
                        getStack={(i) => inventory.getSlot({ area: "inventory", index: i })}
                        onLeftClick={(i, e) => handleLeftClick({ area: "inventory", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "inventory", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Toolbar</h3>
                    <InventoryGrid
                        rows={1}
                        cols={TOOLBAR_COLS}
                        getStack={(i) => inventory.getSlot({ area: "toolbar", index: i + 1 })}
                        onLeftClick={(i, e) => handleLeftClick({ area: "toolbar", index: i + 1 }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "toolbar", index: i + 1 })}
                    />
                </section>
            </SidePanel>

            <CursorStack stack={pickedUp} x={cursorPos.x} y={cursorPos.y} />
        </>
    );
}

registerPanel({
    mode: "cart",
    component: ({ open, engine }) => <CartPanel open={open} inventory={engine.inventory} cartStorage={engine.cartStorage} uiState={engine.uiState} />,
});
