import type { SlotRef } from "../../_boundary/interfaces";

/**
 * 各パネルのローカルなスロット参照（area に "inventory"/"toolbar" 以外の固有領域を含む）を
 * インベントリ用の SlotRef へ変換する。area が "inventory"/"toolbar" であることをランタイムで
 * 確認してから明示的に構築するため `as` を使わずに型安全に変換できる。
 * 想定外の area（各パネル固有の領域など）が渡された場合は例外をスローする。
 */
export function toInventorySlotRef(ref: { area: string; index: number }): SlotRef {
    if (ref.area === "inventory" || ref.area === "toolbar") {
        return { area: ref.area, index: ref.index };
    }
    throw new Error(`Unexpected slot area for inventory: ${ref.area}`);
}
