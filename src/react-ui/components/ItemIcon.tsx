import { useMemo } from "react";
import type { ItemId } from "../../_boundary/interfaces";
import { getItemDef } from "../../_registry/ItemRegistry";
import { getFrameInfo } from "../spritesheets";

/**
 * アイテムアイコン。スプライトシートから CSS background-position で切り出す。
 * spriteName が null の場合は placeholderColor で埋めた矩形を表示する。
 */
export function ItemIcon({ itemId, size = 36 }: { itemId: ItemId; size?: number }) {
    const def = getItemDef(itemId);

    const style = useMemo(() => {
        if (!def) return null;
        if (!def.spriteName) {
            return {
                backgroundColor: `#${(def.placeholderColor ?? 0x888888).toString(16).padStart(6, "0")}`,
                width: size,
                height: size,
            } as const;
        }
        const frame = getFrameInfo(def.spriteName);
        if (!frame) {
            // 未ロード or sheets 未対応のフォールバック
            return {
                backgroundColor: `#${(def.placeholderColor ?? 0x666666).toString(16).padStart(6, "0")}`,
                width: size,
                height: size,
            } as const;
        }
        const scale = size / Math.max(frame.w, frame.h);
        const bgW = frame.sheetWidth * scale;
        const bgH = frame.sheetHeight * scale;
        return {
            backgroundImage: `url("${frame.imageUrl}")`,
            backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
            backgroundSize: `${bgW}px ${bgH}px`,
            width: frame.w * scale,
            height: frame.h * scale,
        } as const;
    }, [def, size]);

    if (!style) return null;

    if ("backgroundImage" in style) {
        return <div className="sg-item-icon" style={style} />;
    }
    return <div className="sg-item-icon-placeholder" style={style} />;
}
