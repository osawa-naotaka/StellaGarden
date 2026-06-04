import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { getDaysElapsedFromVoxel, setDaysElapsedInVoxel, setEnabledInVoxel } from "./VoxelDefs";

/** 塩×n を貯めるまでに必要なゲーム内日数（doc/26 §3.1「2日で塩×n」）。 */
export const SALT_DAYS_PER_CYCLE = 2;
/** 1サイクルで貯まる塩の個数（仮）。 */
export const SALT_PER_CYCLE = 4;

/**
 * 塩田（saltpan）のスロット状態を座標ベースで管理するストレージ（doc/26 §3.1）。
 *
 * 入力を持たず、設置後に受動的に塩を生成する。
 * 経過日数は voxel の growthStage（daysElapsed）に貯め、SALT_DAYS_PER_CYCLE 日ごとに
 * 出力スロットへ塩を加算する。出力が満杯なら進行を保留する。
 * プレイヤーは UI から塩を取り出す。
 */
export interface SaltPanSlots {
    output: ItemStack | null;
}

export class SaltPanStorage extends KeyedSlotStorage<SaltPanSlots> {
    protected createDefaultSlots(): SaltPanSlots {
        return { output: null };
    }

    protected isSlotsEmpty(slots: SaltPanSlots): boolean {
        return slots.output === null;
    }

    protected cloneSlots(slots: SaltPanSlots): SaltPanSlots {
        return { output: slots.output ? { ...slots.output } : null };
    }

    protected toItemStacks(slots: SaltPanSlots): ItemStack[] {
        return slots.output ? [{ ...slots.output }] : [];
    }

    getOutput(pos: Pos2D): ItemStack | null {
        return this.getRaw(pos)?.output ?? null;
    }

    /** 出力スロットを更新する（UI からの取り出し用）。 */
    setOutput(pos: Pos2D, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.output = stack;
        this.updateVoxelEnabled(pos, voxelMap);
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.entries()) {
            const pos = this.posFromKey(key);
            const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surface);
            const days = getDaysElapsedFromVoxel(voxel) + 1;

            if (days < SALT_DAYS_PER_CYCLE) {
                voxelMap.set(setDaysElapsedInVoxel(voxel, days), surface);
                this.updateVoxelEnabled(pos, voxelMap);
                continue;
            }

            // サイクル到達: 塩を加算できるなら加算して進行をリセット、満杯なら保留。
            const max = getItemDef("salt")?.maxStack ?? 64;
            const current = slots.output?.itemId === "salt" ? slots.output.count : slots.output === null ? 0 : -1;
            const canAdd = current >= 0 && current + SALT_PER_CYCLE <= max;

            if (canAdd) {
                slots.output = { itemId: "salt", count: current + SALT_PER_CYCLE };
                voxelMap.set(setDaysElapsedInVoxel(voxel, 0), surface);
            } else {
                // 出力満杯（または想定外 itemId）→ 進行を据え置いて翌日また判定する。
                voxelMap.set(setDaysElapsedInVoxel(voxel, SALT_DAYS_PER_CYCLE), surface);
            }
            this.updateVoxelEnabled(pos, voxelMap);
        }
    }

    /** 出力（取り出せる塩）の有無を voxel の enabled ビットに反映する（スプライト切替に使う）。 */
    private updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        voxelMap.set(setEnabledInVoxel(voxel, this.getOutput(pos) !== null), surface);
    }
}
