import { useCallback } from "react";
import type { IEventBroker, IInventoryWriter, ItemStack } from "../../_boundary/interfaces";
import { Cart } from "../../engine/Cart";
import { CART_ATTACHMENT_ALLOWED } from "../../engine/CartItems";
import type { CartStorage } from "../../engine/CartStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { toInventorySlotRef } from "./slotRef";

const CART_ROWS = 8;
const CART_COLS = 8;
const CART_TOTAL = CART_ROWS * CART_COLS;
const INV_ROWS = 8;
const COLS = 8;
const TOOLBAR_COLS = 9;

type CartSlotArea = "inventory" | "toolbar" | "cart" | "attachment";
type CartSlotRef = { area: CartSlotArea; index: number };

export interface CartPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    cartStorage: CartStorage;
    uiState: UIState;
    eventBroker: IEventBroker;
}

export function CartPanel({ open, inventory, cartStorage, uiState, eventBroker }: CartPanelProps) {
    useFrameTick(open);
    const targetCartId = uiState.targetCartId;

    const getSlot = useCallback(
        (ref: CartSlotRef): ItemStack | null => {
            if (ref.area === "cart") {
                if (targetCartId === null) return null;
                const cart = cartStorage.getByIdWritable(targetCartId);
                return cart?.inventorySlots[ref.index] ?? null;
            }
            if (ref.area === "attachment") {
                if (targetCartId === null) return null;
                const cart = cartStorage.getByIdWritable(targetCartId);
                return cart?.attachmentSlot ?? null;
            }
            return inventory.getSlot(toInventorySlotRef(ref));
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
            if (ref.area === "attachment") {
                if (targetCartId === null) return;
                const cart = cartStorage.getByIdWritable(targetCartId);
                if (!(cart instanceof Cart)) return;
                cart.attachmentSlot = stack;
                // アタッチメント装着をミッションシステムへ通知（M-21）。取り外し（null）は通知しない。
                if (stack !== null) {
                    eventBroker.publish("cart_attachment_set", { cartId: targetCartId, itemId: stack.itemId });
                }
                return;
            }
            inventory.setSlot(toInventorySlotRef(ref), stack);
        },
        [inventory, cartStorage, targetCartId, eventBroker],
    );

    const canPlaceTo = useCallback((ref: CartSlotRef, stack: ItemStack): boolean => {
        if (ref.area === "attachment") {
            return CART_ATTACHMENT_ALLOWED.has(stack.itemId);
        }
        return true;
    }, []);

    const getQuickTransferTargets = useCallback(
        (ref: CartSlotRef): CartSlotRef[] | undefined => {
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "cart" || ref.area === "attachment") {
                // cart / attachment → inventory → toolbar 1..9 (hand=0 を除外)
                const targets: CartSlotRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // inventory / toolbar → cart（attachment はクイック転送対象から除外: allowlist 制限のため個別操作を要求）
            if (targetCartId === null) return undefined;
            const targets: CartSlotRef[] = [];
            for (let i = 0; i < CART_TOTAL; i++) targets.push({ area: "cart", index: i });
            return targets;
        },
        [targetCartId],
    );

    const getQuickTransferSources = useCallback((ref: CartSlotRef): CartSlotRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "cart" || ref.area === "attachment") {
            const sources: CartSlotRef[] = [];
            for (let i = 0; i < CART_TOTAL; i++) sources.push({ area: "cart", index: i });
            return sources;
        }
        // inventory + toolbar(1..9) を同じ側として扱う
        const sources: CartSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<CartSlotRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
        getQuickTransferTargets,
        getQuickTransferSources,
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

    const getAttachmentSlot = useCallback(
        (_i: number): ItemStack | null => {
            if (targetCartId === null) return null;
            const cart = cartStorage.getByIdWritable(targetCartId);
            return cart?.attachmentSlot ?? null;
        },
        [cartStorage, targetCartId],
    );

    return (
        <>
            <SidePanel open={open} title="Cart" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Attachment</h3>
                    {/* sickle のみ装着可能。canPlaceTo で allowlist チェックされる。 */}
                    <InventoryGrid
                        rows={1}
                        cols={1}
                        getStack={getAttachmentSlot}
                        onLeftClick={(_i, e) => handleLeftClick({ area: "attachment", index: 0 }, e.nativeEvent)}
                        onRightClick={(_i) => handleRightClick({ area: "attachment", index: 0 })}
                    />
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
    component: ({ open, engine }) => (
        <CartPanel open={open} inventory={engine.inventory} cartStorage={engine.cartStorage} uiState={engine.uiState} eventBroker={engine.eventBroker} />
    ),
});
