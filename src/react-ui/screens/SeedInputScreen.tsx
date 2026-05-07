import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { TITLE_BG, TITLE_TEXT_SX } from "./titleStyles";

function randomSeed(): string {
    return Math.floor(Math.random() * 2 ** 32).toString();
}

interface Props {
    onConfirm: (seed: string) => void;
    onBack: () => void;
}

export function SeedInputScreen({ onConfirm, onBack }: Props) {
    const [seed, setSeed] = useState(randomSeed);

    return (
        <Box sx={TITLE_BG}>
            <Stack spacing={4} alignItems="center">
                <Typography variant="h2" sx={TITLE_TEXT_SX}>
                    Stella Garden
                </Typography>
                <Typography variant="h6" sx={{ color: "#a5d6a7" }}>
                    ワールドシードを入力してください
                </Typography>
                <Stack spacing={2} sx={{ minWidth: 360 }}>
                    <TextField
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                        label="シード"
                        variant="outlined"
                        fullWidth
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                color: "#e8f5e9",
                                "& fieldset": { borderColor: "#4caf50" },
                                "&:hover fieldset": { borderColor: "#388e3c" },
                                "&.Mui-focused fieldset": { borderColor: "#4caf50" },
                            },
                            "& .MuiInputLabel-root": {
                                color: "#a5d6a7",
                                "&.Mui-focused": { color: "#4caf50" },
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => onConfirm(seed.trim())}
                        sx={{ bgcolor: "#4caf50", "&:hover": { bgcolor: "#388e3c" }, fontSize: "1.1rem", py: 1.5 }}
                    >
                        はじめる
                    </Button>
                </Stack>
                <Button variant="text" onClick={onBack} sx={{ color: "#a5d6a7", "&:hover": { color: "#e8f5e9" } }}>
                    戻る
                </Button>
            </Stack>
        </Box>
    );
}
