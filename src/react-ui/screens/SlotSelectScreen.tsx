import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { deleteSlot, duplicateSlot, listSlots, newSlotId, renameSlot, type SaveSlot, type SlotEntry } from "../../lib/SaveSystem";
import { TITLE_BG, TITLE_TEXT_SX } from "./titleStyles";

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

const ROW_SX = {
    border: "1px solid #4caf50",
    borderRadius: 1,
    p: 2,
    color: "#e8f5e9",
    bgcolor: "rgba(76,175,80,0.05)",
} as const;

const ACTION_BTN_SX = {
    color: "#e8f5e9",
    borderColor: "#4caf50",
    "&:hover": { borderColor: "#388e3c", bgcolor: "rgba(76,175,80,0.15)" },
} as const;

const DANGER_BTN_SX = {
    color: "#ffcdd2",
    borderColor: "#e57373",
    "&:hover": { borderColor: "#c62828", bgcolor: "rgba(229,115,115,0.15)" },
} as const;

interface SlotRowProps {
    entry: SlotEntry;
    mode: "new" | "load";
    onLoad: (slot: SaveSlot) => void;
    onDuplicate: (slot: SaveSlot) => void;
    onDelete: (entry: SlotEntry) => void;
    onRename: (slot: SaveSlot, newName: string) => void;
}

function SlotRow({ entry, mode, onLoad, onDuplicate, onDelete, onRename }: SlotRowProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(entry.slotName);

    const startEdit = useCallback(() => {
        setDraft(entry.slotName);
        setEditing(true);
    }, [entry.slotName]);

    const commit = useCallback(() => {
        const trimmed = draft.trim();
        if (trimmed.length > 0 && trimmed !== entry.slotName) {
            onRename(entry.slot, trimmed);
        }
        setEditing(false);
    }, [draft, entry.slot, entry.slotName, onRename]);

    const cancel = useCallback(() => {
        setDraft(entry.slotName);
        setEditing(false);
    }, [entry.slotName]);

    return (
        <Box sx={ROW_SX}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                        <TextField
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commit();
                                else if (e.key === "Escape") cancel();
                            }}
                            autoFocus
                            size="small"
                            variant="outlined"
                            fullWidth
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    color: "#e8f5e9",
                                    "& fieldset": { borderColor: "#4caf50" },
                                    "&:hover fieldset": { borderColor: "#388e3c" },
                                    "&.Mui-focused fieldset": { borderColor: "#4caf50" },
                                },
                            }}
                        />
                    ) : (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography
                                variant="subtitle1"
                                onClick={startEdit}
                                sx={{
                                    cursor: "pointer",
                                    "&:hover": { textDecoration: "underline" },
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                                title="クリックして名前を編集"
                            >
                                {entry.slotName}
                            </Typography>
                            <IconButton size="small" onClick={startEdit} sx={{ color: "#a5d6a7" }} title="名前を編集">
                                <span style={{ fontSize: "0.85rem" }}>✎</span>
                            </IconButton>
                        </Stack>
                    )}
                    <Typography variant="caption" sx={{ color: "#a5d6a7" }}>
                        {formatTimestamp(entry.timestamp)}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" onClick={() => onLoad(entry.slot)} sx={ACTION_BTN_SX} disabled={mode === "new"}>
                        読み込む
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => onDuplicate(entry.slot)} sx={ACTION_BTN_SX}>
                        複製
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => onDelete(entry)} sx={DANGER_BTN_SX}>
                        削除
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

export function SlotSelectScreen({ mode, onSelect, onBack }: Props) {
    const [slots, setSlots] = useState<SlotEntry[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<SlotEntry | null>(null);

    const refresh = useCallback(() => {
        listSlots().then((entries) => {
            setSlots(entries);
            setLoaded(true);
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleNewSlot = useCallback(() => {
        onSelect(newSlotId());
    }, [onSelect]);

    const handleDuplicate = useCallback(
        async (slot: SaveSlot) => {
            await duplicateSlot(slot);
            refresh();
        },
        [refresh],
    );

    const handleConfirmDelete = useCallback(async () => {
        if (!confirmDelete) return;
        await deleteSlot(confirmDelete.slot);
        setConfirmDelete(null);
        refresh();
    }, [confirmDelete, refresh]);

    const handleRename = useCallback(
        async (slot: SaveSlot, newName: string) => {
            await renameSlot(slot, newName);
            refresh();
        },
        [refresh],
    );

    const title = mode === "new" ? "新しいセーブデータを作成しますか？" : "どのデータを読み込みますか？";

    return (
        <Box sx={TITLE_BG}>
            <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 720, px: 2 }}>
                <Typography variant="h2" sx={TITLE_TEXT_SX}>
                    Stella Garden
                </Typography>
                <Typography variant="h6" sx={{ color: "#a5d6a7" }}>
                    {title}
                </Typography>

                <Stack spacing={2} sx={{ width: "100%" }}>
                    {mode === "new" && (
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleNewSlot}
                            sx={{ bgcolor: "#4caf50", "&:hover": { bgcolor: "#388e3c" }, fontSize: "1.1rem", py: 1.5 }}
                        >
                            ＋ 新しいスロットを作成
                        </Button>
                    )}

                    {loaded && slots.length === 0 && mode === "load" && (
                        <Typography sx={{ color: "#a5d6a7", textAlign: "center", py: 4 }}>セーブデータがありません</Typography>
                    )}

                    {slots.map((entry) => (
                        <SlotRow
                            key={entry.slot}
                            entry={entry}
                            mode={mode}
                            onLoad={onSelect}
                            onDuplicate={handleDuplicate}
                            onDelete={setConfirmDelete}
                            onRename={handleRename}
                        />
                    ))}
                </Stack>

                <Button variant="text" onClick={onBack} sx={{ color: "#a5d6a7", "&:hover": { color: "#e8f5e9" } }}>
                    戻る
                </Button>
            </Stack>

            <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
                <DialogTitle>セーブデータを削除しますか？</DialogTitle>
                <DialogContent>
                    <DialogContentText>「{confirmDelete?.slotName}」を削除します。この操作は取り消せません。</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDelete(null)}>キャンセル</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        削除する
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
