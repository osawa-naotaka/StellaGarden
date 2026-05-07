import { Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { getSlotInfo } from "../../lib/SaveSystem";
import { BTN_OUTLINED_SX, TITLE_BG, TITLE_TEXT_SX } from "./titleStyles";

interface Props {
    onNewGame: () => void;
    onContinue: () => void;
}

export function TitleScreen({ onNewGame, onContinue }: Props) {
    const [anySlotExists, setAnySlotExists] = useState<boolean | null>(null);

    useEffect(() => {
        Promise.all([getSlotInfo(1), getSlotInfo(2), getSlotInfo(3)]).then((infos) => {
            setAnySlotExists(infos.some((info) => info.exists));
        });
    }, []);

    return (
        <Box sx={TITLE_BG}>
            <Stack spacing={4} alignItems="center">
                <Typography variant="h2" sx={TITLE_TEXT_SX}>
                    Stella Garden
                </Typography>
                <Stack spacing={2} sx={{ minWidth: 240 }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={onNewGame}
                        sx={{ bgcolor: "#4caf50", "&:hover": { bgcolor: "#388e3c" }, fontSize: "1.1rem", py: 1.5 }}
                    >
                        はじめから
                    </Button>
                    <Button variant="outlined" size="large" disabled={anySlotExists === null || !anySlotExists} onClick={onContinue} sx={BTN_OUTLINED_SX}>
                        つづきから
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
