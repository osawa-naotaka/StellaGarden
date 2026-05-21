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
    /**
     * Ctrl/Cmd + 左クリック時、source ref のアイテムを順に試す転送先 ref のリストを返す。
     * 試行順は配列の先頭から（pass1: 同 itemId に top-up、pass2: 空スロットに新規）。
     * undefined / 空配列を返すと quickTransfer は無効。canPlaceTo が定義されていれば各 target に対するフィルタとしてそのまま流用する。
     */
    getQuickTransferTargets?: (ref: R, stack: ItemStack) => R[] | undefined;
    /**
     * Ctrl/Cmd + 左クリック時、source ref と同じインベントリ側にある全スロット参照を返す。
     * このリスト中で同じ itemId を持つスロット全てが一括で targets に転送される。
     * 未定義の場合は従来通り source ref 1スロットのみ転送する。
     */
    getQuickTransferSources?: (ref: R) => R[] | undefined;
}

export interface PickupState<R> {
    pickedUp: ItemStack | null;
    cursorPos: { x: number; y: number };
    handleLeftClick: (ref: R, e?: MouseEvent | { ctrlKey?: boolean; metaKey?: boolean }) => void;
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

    const handleLeftClick = useCallback((ref: R, e?: MouseEvent | { ctrlKey?: boolean; metaKey?: boolean }) => {
        const cfg = cfgRef.current;
        const isQuickTransfer = !!(e && (e.ctrlKey || e.metaKey));

        setPicked((prev) => {
            const target = cfg.getSlot(ref);

            // Ctrl/Cmd + クリック: ピックアップ中ではない & 対象あり & getQuickTransferTargets 定義済み のとき quickTransfer
            if (isQuickTransfer && !prev && target && cfg.getQuickTransferTargets) {
                const targets = cfg.getQuickTransferTargets(ref, target);
                if (!targets || targets.length === 0) return null;
                const itemId = target.itemId;
                const max = getItemDef(itemId)?.maxStack ?? 64;

                // ソース側スロットを列挙: 同 itemId のものだけ。クリックされた ref を先頭に並べ替える
                const allSources = cfg.getQuickTransferSources ? (cfg.getQuickTransferSources(ref) ?? [ref]) : [ref];
                const matchingSources: R[] = [];
                for (const s of allSources) {
                    const slot = cfg.getSlot(s);
                    if (slot && slot.itemId === itemId) matchingSources.push(s);
                }
                const clickedIdx = matchingSources.findIndex((s) => s === ref);
                if (clickedIdx > 0) {
                    matchingSources.splice(clickedIdx, 1);
                    matchingSources.unshift(ref);
                }

                const originalTotal = matchingSources.reduce((sum, s) => sum + (cfg.getSlot(s)?.count ?? 0), 0);
                if (originalTotal === 0) return null;
                let remaining = originalTotal;

                // pass1: 既存スタックに追加（同 itemId、max まで）
                for (const t of targets) {
                    if (remaining === 0) break;
                    if (cfg.canPlaceTo && !cfg.canPlaceTo(t, target)) continue;
                    const slot = cfg.getSlot(t);
                    if (!slot || slot.itemId !== itemId) continue;
                    const space = max - slot.count;
                    if (space <= 0) continue;
                    const move = Math.min(space, remaining);
                    cfg.setSlot(t, { itemId: slot.itemId, count: slot.count + move });
                    remaining -= move;
                }

                // pass2: 空スロットに新規（maxStack 単位で詰める）
                for (const t of targets) {
                    if (remaining === 0) break;
                    if (cfg.canPlaceTo && !cfg.canPlaceTo(t, target)) continue;
                    if (cfg.getSlot(t)) continue;
                    const move = Math.min(max, remaining);
                    cfg.setSlot(t, { itemId, count: move });
                    remaining -= move;
                }

                // source 側を更新: 移送量を先頭から順に各スロットから引く
                let movedTotal = originalTotal - remaining;
                for (const s of matchingSources) {
                    if (movedTotal === 0) break;
                    const slot = cfg.getSlot(s);
                    if (!slot) continue;
                    if (slot.count <= movedTotal) {
                        cfg.setSlot(s, null);
                        movedTotal -= slot.count;
                    } else {
                        cfg.setSlot(s, { itemId: slot.itemId, count: slot.count - movedTotal });
                        movedTotal = 0;
                    }
                }
                return null;
            }

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
