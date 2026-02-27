import type { Pos3D } from "../lib/VoxelMap";

/** ゲーム内イベントの型定義。 */
export type GameEventMap = {
    interact: { pos: Pos3D; entity: number };
    select_slot: { slotIndex: number };
};
