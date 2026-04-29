import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemStack } from "../../_boundary/interfaces";
import { getItemDef } from "../../_registry/ItemRegistry";

export interface UsePickupConfig<R> {
    /** スロット参照から ItemStack を取得する。null なら空。 */
    getSlot: (ref: R) => ItemStack | null;
    /** スロット参照に ItemStack を書き込む。null で空にする。 */
    setSlot: (ref: R, stack: ItemStack | null) => void;
    /**
     * 右クリック時に「アイテムが配置可能ならそれを処理する」フック。
     * true を返すと通常の「1個ピックアップ」処理をスキップする。
     * Inventory パネルから placement mode に入る用途。
     */
    onPlaceableRightClick?: (ref: R, stack: ItemStack) => boolean;
    /** スロット種別ごとに配置を制限する場合のフィルタ。false を返すと配置不可。 */
    canPlaceTo?: (ref: R, stack: ItemStack) => boolean;
}

export interface PickupState<R> {
    pickedUp: ItemStack | null;
    cursorPos: { x: number; y: number };
    handleLeftClick: (ref: R) => void;
    handleRightClick: (ref: R) => void;
    /** 持っているアイテムを source に戻して null にする。 */
    returnToSource: () => void;
}

/**
 * スロットウィンドウ系UIで共有するピックアップ操作のフック。
 * アクティブでない（パネルが閉じている）間は picked-up を自動で source に戻す。
 */
export function usePickup<R>(active: boolean, config: UsePickupConfig<R>): PickupState<R> {
    const [picked, setPicked] = useState<{ stack: ItemStack; source: R } | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const cfgRef = useRef(config);
    cfgRef.current = config;

    // パネルが閉じる時、持っているアイテムを source に戻す
    useEffect(() => {
        if (active) return;
        if (!picked) return;
        cfgRef.current.setSlot(picked.source, picked.stack);
        setPicked(null);
    }, [active, picked]);

    // マウス追従（active な時だけ）
    useEffect(() => {
        if (!active) return;
        const onMove = (e: globalThis.MouseEvent) => {
            setCursorPos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, [active]);

    // Escape でピックアップキャンセル（パネル閉じより優先）
    useEffect(() => {
        if (!active) return;
        if (!picked) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                cfgRef.current.setSlot(picked.source, picked.stack);
                setPicked(null);
                e.stopPropagation();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [active, picked]);

    const handleLeftClick = useCallback((ref: R) => {
        const cfg = cfgRef.current;

        setPicked((prev) => {
            const target = cfg.getSlot(ref);

            // 何も持っていない → ピックアップ
            if (!prev) {
                if (!target) return null;
                cfg.setSlot(ref, null);
                return { stack: { ...target }, source: ref };
            }

            // 配置可否チェック
            if (cfg.canPlaceTo && !cfg.canPlaceTo(ref, prev.stack)) return prev;

            // 空スロット → 全部置く
            if (!target) {
                cfg.setSlot(ref, prev.stack);
                return null;
            }

            // 同種スタッキング
            if (target.itemId === prev.stack.itemId) {
                const max = getItemDef(prev.stack.itemId)?.maxStack ?? 64;
                const total = target.count + prev.stack.count;
                if (total <= max) {
                    cfg.setSlot(ref, { itemId: target.itemId, count: total });
                    return null;
                }
                cfg.setSlot(ref, { itemId: target.itemId, count: max });
                return { stack: { itemId: prev.stack.itemId, count: total - max }, source: ref };
            }

            // 異種交換
            cfg.setSlot(ref, prev.stack);
            return { stack: { ...target }, source: ref };
        });
    }, []);

    const handleRightClick = useCallback((ref: R) => {
        const cfg = cfgRef.current;

        setPicked((prev) => {
            // 何も持っていない時の右クリック
            if (!prev) {
                const target = cfg.getSlot(ref);
                if (!target) return null;
                if (cfg.onPlaceableRightClick?.(ref, target)) return null;
                const taken: ItemStack = { itemId: target.itemId, count: 1 };
                if (target.count === 1) cfg.setSlot(ref, null);
                else cfg.setSlot(ref, { itemId: target.itemId, count: target.count - 1 });
                return { stack: taken, source: ref };
            }

            // 配置可否チェック
            if (cfg.canPlaceTo && !cfg.canPlaceTo(ref, prev.stack)) return prev;

            // 持っている時の右クリック → 1個置く
            const target = cfg.getSlot(ref);
            if (!target) {
                cfg.setSlot(ref, { itemId: prev.stack.itemId, count: 1 });
                const remaining = prev.stack.count - 1;
                if (remaining === 0) return null;
                return { stack: { itemId: prev.stack.itemId, count: remaining }, source: prev.source };
            }
            if (target.itemId === prev.stack.itemId) {
                const max = getItemDef(prev.stack.itemId)?.maxStack ?? 64;
                if (target.count < max) {
                    cfg.setSlot(ref, { itemId: target.itemId, count: target.count + 1 });
                    const remaining = prev.stack.count - 1;
                    if (remaining === 0) return null;
                    return { stack: { itemId: prev.stack.itemId, count: remaining }, source: prev.source };
                }
            }
            return prev;
        });
    }, []);

    const returnToSource = useCallback(() => {
        setPicked((prev) => {
            if (!prev) return null;
            cfgRef.current.setSlot(prev.source, prev.stack);
            return null;
        });
    }, []);

    return {
        pickedUp: picked?.stack ?? null,
        cursorPos,
        handleLeftClick,
        handleRightClick,
        returnToSource,
    };
}
