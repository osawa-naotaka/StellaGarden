import { useEffect, useReducer, useRef, useState } from "react";
import { useEngine } from "../EngineContext";

/**
 * 画面左下に常時表示されるミッション進行パネル。
 *
 * - メインミッション 1 行 + 現在のサブミッション 1 行を表示する
 * - サブが完了した瞬間は ✓ + フェードアウト演出を流し、1.5 秒後に次のサブへ
 * - 全ミッション完了時はパネル自体を非表示にする
 *
 * 再描画は MissionSystem.onChange で駆動（毎フレーム描画ではなく変化通知ベース）。
 */
export function MissionPanel() {
    const { missionSystem } = useEngine();
    // MissionSystem の状態変化を受けて再描画する。
    const [, forceUpdate] = useReducer((x: number) => (x + 1) | 0, 0);
    useEffect(() => missionSystem.onChange(forceUpdate), [missionSystem]);

    const currentMain = missionSystem.getCurrentMain();
    const currentSub = missionSystem.getCurrentSub();

    // 完了演出中のサブ（直前まで表示していて、今フレーム消えたもの）。
    const [completingSub, setCompletingSub] = useState<{ id: string; text: string } | null>(null);
    // 直前まで表示していたサブ。サブが切り替わったときに完了演出を出すために保持。
    const prevSubRef = useRef<{ id: string; text: string } | null>(null);
    const initRef = useRef(false);

    useEffect(() => {
        const newSub = currentSub ? { id: currentSub.id, text: currentSub.text } : null;

        if (!initRef.current) {
            // 初回マウント時は完了演出をスキップ（既にロード済みの状態を演出してはいけない）。
            prevSubRef.current = newSub;
            initRef.current = true;
            return;
        }

        const prev = prevSubRef.current;
        if (prev !== null && prev.id !== (newSub?.id ?? null)) {
            // サブが切り替わった = 前のサブが完了した（または別メインに移った）
            setCompletingSub(prev);
            const timer = window.setTimeout(() => setCompletingSub(null), 1500);
            prevSubRef.current = newSub;
            return () => window.clearTimeout(timer);
        }
        prevSubRef.current = newSub;
    }, [currentSub?.id, currentSub?.text]);

    if (!currentMain) {
        // 全完了。何も表示しない。
        return null;
    }

    return (
        <div className="sg-mission-panel">
            <div className="sg-mission-main">{currentMain.title}</div>
            <div className="sg-mission-sub-area">
                {completingSub ? (
                    <div key={completingSub.id} className="sg-mission-sub is-completed">
                        <span className="sg-mission-checkmark">✓</span>
                        <span className="sg-mission-sub-text">{completingSub.text}</span>
                    </div>
                ) : currentSub ? (
                    <div key={currentSub.id} className="sg-mission-sub">
                        <span className="sg-mission-sub-text">{currentSub.text}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
