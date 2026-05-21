import { useEffect, useState } from "react";
import type { GameEventMap } from "../../_boundary/events";
import type { IEventBroker } from "../../_boundary/interfaces";
import type { UIMode, UIState } from "../../view/UIState";

const MODE_CHANGING_EVENTS: ReadonlyArray<keyof GameEventMap> = [
    "toggle_inventory",
    "open_craft_ui",
    "open_chest_ui",
    "open_forge_ui",
    "open_warp_gate_ui",
    "open_winch_ui",
];

/**
 * UIState.mode の変化を React state として観測するフック。
 * UIState は EventBroker のサブスクライバとして mode を更新する。
 * このフックは同じイベントを後段で購読し、UIState 更新後に mode を読む。
 */
export function useUIMode(uiState: UIState, broker: IEventBroker): UIMode {
    const [mode, setMode] = useState<UIMode>(uiState.mode);

    useEffect(() => {
        // EventBroker の購読は登録順に呼ばれるため、UIState が先に subscribeEvents 済みなら
        // ここで購読したコールバックは UIState 更新後に呼ばれる。
        const disposers = MODE_CHANGING_EVENTS.map((eventName) =>
            broker.subscribe(eventName, () => {
                setMode(uiState.mode);
            }),
        );
        // placement モードや exit 等、イベント外で mode が変わる経路もあるので RAF で同期
        let raf = 0;
        let mounted = true;
        const checkMode = () => {
            if (!mounted) return;
            setMode((prev) => (prev === uiState.mode ? prev : uiState.mode));
            raf = requestAnimationFrame(checkMode);
        };
        raf = requestAnimationFrame(checkMode);
        return () => {
            mounted = false;
            cancelAnimationFrame(raf);
            disposers.forEach((d) => {
                d();
            });
        };
    }, [uiState, broker]);

    return mode;
}
