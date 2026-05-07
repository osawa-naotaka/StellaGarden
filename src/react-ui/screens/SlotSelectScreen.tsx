import { Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { getSlotInfo, type SaveSlot } from "../../lib/SaveSystem";
import { BTN_OUTLINED_SX, TITLE_BG, TITLE_TEXT_SX } from "./titleStyles";

interface SlotInfoState {
    exists: boolean;
    timestamp: number | null;
}

interface Props {
    mode: "new" | "load";
    onSelect: (slot: SaveSlot) => void;
    onBack: () => void;
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

export function SlotSelectScreen({ mode, onSelect, onBack }: Props) {
    const [slotInfos, setSlotInfos] = useState<SlotInfoState[]>([
        { exists: false, timestamp: null },
        { exists: false, timestamp: null },
        { exists: false, timestamp: null },
    ]);

    useEffect(() => {
        Promise.all([getSlotInfo(1), getSlotInfo(2), getSlotInfo(3)]).then(setSlotInfos);
    }, []);

    const title = mode === "new" ? "どのスロットに保存しますか？" : "どのデータを読み込みますか？";

    return (
        <Box sx={TITLE_BG}>
            <Stack spacing={4} alignItems="center">
                <Typography variant="h2" sx={TITLE_TEXT_SX}>
                    Stella Garden
                </Typography>
                <Typography variant="h6" sx={{ color: "#a5d6a7" }}>
                    {title}
                </Typography>
                <Stack spacing={2} sx={{ minWidth: 360 }}>
                    {([1, 2, 3] as SaveSlot[]).map((slot, i) => {
                        const info = slotInfos[i];
                        const disabled = mode === "load" && !info.exists;
                        return (
                            <Button
                                key={slot}
                                variant="outlined"
                                size="large"
                                disabled={disabled}
                                onClick={() => onSelect(slot)}
                                sx={{
                                    ...BTN_OUTLINED_SX,
                                    justifyContent: "space-between",
                                    px: 3,
                                }}
                            >
                                <span>スロット {slot}</span>
                                <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                                    {info.exists && info.timestamp ? formatTimestamp(info.timestamp) : "空のスロット"}
                                </span>
                            </Button>
                        );
                    })}
                </Stack>
                <Button variant="text" onClick={onBack} sx={{ color: "#a5d6a7", "&:hover": { color: "#e8f5e9" } }}>
                    戻る
                </Button>
            </Stack>
        </Box>
    );
}
