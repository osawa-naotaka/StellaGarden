import type { Direction8, ICartWriter, ItemStack, Pos2D } from "../_boundary/interfaces";

export const CART_INVENTORY_SLOTS = 16;

/**
 * 台車（Cart）エンティティ。
 * voxelMap には載らない移動層エンティティ。CartStorage が所有・管理する。
 */
export class Cart implements ICartWriter {
    readonly id: number;
    posInWorld: Pos2D;
    readonly inventorySlots: (ItemStack | null)[];
    attachmentSlot: ItemStack | null;

    /** facing の内部バッキングフィールド。CartStorage.tickAll が更新する。 */
    private facing_: Direction8 = "right";

    constructor(id: number, posInWorld: Pos2D) {
        this.id = id;
        this.posInWorld = { x: posInWorld.x, z: posInWorld.z };
        this.inventorySlots = new Array<ItemStack | null>(CART_INVENTORY_SLOTS).fill(null);
        this.attachmentSlot = null;
    }

    get facing(): Direction8 {
        return this.facing_;
    }

    /** CartStorage.tickAll から呼ぶ。外部モジュールからは直接呼ばないこと。 */
    setFacing(facing: Direction8): void {
        this.facing_ = facing;
    }

    /** CartStorage.tickAll から呼ぶ。外部モジュールからは直接呼ばないこと。 */
    setPosInWorld(pos: Pos2D): void {
        this.posInWorld.x = pos.x;
        this.posInWorld.z = pos.z;
    }

    setInventorySlot(index: number, stack: ItemStack | null): void {
        if (index < 0 || index >= CART_INVENTORY_SLOTS) return;
        this.inventorySlots[index] = stack;
    }

    isInventoryEmpty(): boolean {
        return this.inventorySlots.every((s) => s === null);
    }
}
