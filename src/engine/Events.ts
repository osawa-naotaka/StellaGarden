import type { Pos2D } from "../lib/VoxelMap";

/** ゲーム内イベントの型定義。 */
export type GameEventMap = {
    interact: { pos: Pos2D };
    select_slot: { slotIndex: number };
    toggle_inventory: Record<string, never>;
};
