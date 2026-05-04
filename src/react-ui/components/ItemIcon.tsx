import { useMemo } from "react";
import type { ItemId } from "../../_boundary/interfaces";
import { getItemDef } from "../../_registry/ItemRegistry";
import { getFrameInfo } from "../spritesheets";

/**
 * アイテムアイコン。スプライトシートから CSS background-position で切り出す。
 * spriteName が null の場合は placeholderColor で埋めた矩形を表示する。
 * TexturePacker で回転格納（rotated:true）されたフレームは内側の div に
 * transform: rotate(-90deg) を適用して元の向きに戻す。
 */
export function ItemIcon({ itemId, size = 48 }: { itemId: ItemId; size?: number }) {
    const def = getItemDef(itemId);

    const data = useMemo(() => {
        if (!def) return null;
        if (!def.spriteName) {
            return { kind: "placeholder" as const, color: def.placeholderColor ?? 0x888888 };
        }
        const frame = getFrameInfo(def.spriteName);
        if (!frame) {
            return { kind: "placeholder" as const, color: def.placeholderColor ?? 0x666666 };
        }

        // rotated=true の時、PNG 内の (frame.w, frame.h) は元画像 (h, w) と逆転している
        const sourceW = frame.rotated ? frame.h : frame.w;
        const sourceH = frame.rotated ? frame.w : frame.h;
        const scale = size / Math.max(sourceW, sourceH);

        return {
            kind: "sprite" as const,
            imageUrl: frame.imageUrl,
            // 表示時の最終ボックスサイズ（元画像と同じ向き）
            displayW: sourceW * scale,
            displayH: sourceH * scale,
            // PNG 内のスライスサイズ（rotated 時はこれが回転前ボックス）
            sliceW: frame.w * scale,
            sliceH: frame.h * scale,
            backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
            backgroundSize: `${frame.sheetWidth * scale}px ${frame.sheetHeight * scale}px`,
            rotated: frame.rotated,
        };
    }, [def, size]);

    if (!data) return null;

    if (data.kind === "placeholder") {
        const colorHex = `#${data.color.toString(16).padStart(6, "0")}`;
        return (
            <div className="sg-item-icon-placeholder" style={{ width: size, height: size, backgroundColor: colorHex }} />
        );
    }

    if (!data.rotated) {
        return (
            <div
                className="sg-item-icon"
                style={{
                    width: data.displayW,
                    height: data.displayH,
                    backgroundImage: `url("${data.imageUrl}")`,
                    backgroundPosition: data.backgroundPosition,
                    backgroundSize: data.backgroundSize,
                }}
            />
        );
    }

    // rotated: 外側で表示サイズを確保し、内側を -90° 回転して元の向きに戻す
    return (
        <div style={{ width: data.displayW, height: data.displayH, position: "relative", overflow: "hidden" }}>
            <div
                className="sg-item-icon"
                style={{
                    position: "absolute",
                    width: data.sliceW,
                    height: data.sliceH,
                    top: "50%",
                    left: "50%",
                    backgroundImage: `url("${data.imageUrl}")`,
                    backgroundPosition: data.backgroundPosition,
                    backgroundSize: data.backgroundSize,
                    transform: "translate(-50%, -50%) rotate(-90deg)",
                    transformOrigin: "center",
                }}
            />
        </div>
    );
}
