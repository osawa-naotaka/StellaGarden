import { useEffect, useState } from "react";

/**
 * パネルが表示中の間、毎フレーム再レンダリングを起こすフック。
 * engine の状態変化を逃さず反映するための簡易解。
 * 後で必要に応じてイベント駆動に置き換え可能。
 */
export function useFrameTick(active: boolean): number {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!active) return;
        let mounted = true;
        let raf = 0;
        const loop = () => {
            if (!mounted) return;
            setTick((t) => (t + 1) | 0);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            mounted = false;
            cancelAnimationFrame(raf);
        };
    }, [active]);

    return tick;
}
