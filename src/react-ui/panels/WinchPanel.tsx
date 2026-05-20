import { useCallback } from "react";
import type { IVoxelWriter } from "../../_boundary/interfaces";
import { getVariantFromVoxel, setVariantInVoxel, VOXEL_VARIANT } from "../../engine/VoxelDefs";
import type { UIState } from "../../view/UIState";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { registerPanel } from "../PanelRegistry";

export interface WinchPanelProps {
    open: boolean;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function WinchPanel({ open, voxelMap, uiState }: WinchPanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const isOn = (() => {
        if (!targetPos) return false;
        const surface = voxelMap.getSurfacePosition({ x: targetPos.x, y: 0, z: targetPos.z });
        const voxel = voxelMap.get(surface);
        return getVariantFromVoxel(voxel) === VOXEL_VARIANT.on;
    })();

    const handleToggle = useCallback(() => {
        if (!targetPos) return;
        const surface = voxelMap.getSurfacePosition({ x: targetPos.x, y: 0, z: targetPos.z });
        const voxel = voxelMap.get(surface);
        const next = getVariantFromVoxel(voxel) === VOXEL_VARIANT.on ? VOXEL_VARIANT.off : VOXEL_VARIANT.on;
        voxelMap.set(setVariantInVoxel(voxel, next), surface);
    }, [targetPos, voxelMap]);

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.targetPos = null;
    }, [uiState]);

    return (
        <SidePanel open={open} title="Winch" onClose={close}>
            <section className="sg-sidepanel-section">
                <h3 className="sg-section-title">Power</h3>
                <button
                    type="button"
                    className={`sg-toggle-switch${isOn ? " is-on" : ""}`}
                    onClick={handleToggle}
                >
                    {isOn ? "ON" : "OFF"}
                </button>
            </section>
        </SidePanel>
    );
}

registerPanel({
    mode: "winch",
    component: ({ open, engine }) => <WinchPanel open={open} voxelMap={engine.voxelMap} uiState={engine.uiState} />,
});
