import type { ComponentType } from "react";
import type { UIMode } from "../view/UIState";
import type { EngineRefs } from "./EngineContext";

/**
 * パネル定義。各パネルファイルがモジュールロード時に registerPanel() で自己登録する。
 *
 * SgUiRoot は登録された PanelDef をイテレートして描画するため、
 * パネル追加時に SgUiRoot を編集する必要はない。
 */
export interface PanelDef {
    /** このパネルが表示される UIMode。 */
    readonly mode: UIMode;
    /**
     * パネル本体。SgUiRoot から `open` と engine refs を受け取る。
     * 内部で必要な engine フィールドだけ取り出して具体的なパネルコンポーネントに渡す。
     */
    readonly component: ComponentType<{ open: boolean; engine: EngineRefs }>;
}

const panels: PanelDef[] = [];

/** モジュールロード時に呼ばれ、パネルを登録する。重複 mode の登録は警告を出す。 */
export function registerPanel(def: PanelDef): void {
    if (panels.some((p) => p.mode === def.mode)) {
        console.warn(`[PanelRegistry] mode "${def.mode}" は既に登録されています。後勝ちで上書きします。`);
        const idx = panels.findIndex((p) => p.mode === def.mode);
        panels[idx] = def;
        return;
    }
    panels.push(def);
}

/** 登録済みパネル一覧を返す（読み取り専用）。 */
export function getRegisteredPanels(): readonly PanelDef[] {
    return panels;
}
