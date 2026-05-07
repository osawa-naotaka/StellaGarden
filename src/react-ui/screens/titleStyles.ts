/** タイトル画面・スロット選択画面で共有するスタイル定数。 */

export const TITLE_BG = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f17 100%)",
} as const;

export const TITLE_TEXT_SX = {
    color: "#e8f5e9",
    fontWeight: 700,
    letterSpacing: 4,
    textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
} as const;

export const BTN_OUTLINED_SX = {
    color: "#e8f5e9",
    borderColor: "#4caf50",
    "&:hover": { borderColor: "#388e3c", bgcolor: "rgba(76,175,80,0.1)" },
    "&.Mui-disabled": { color: "#5a5a5a", borderColor: "#3a3a3a" },
    fontSize: "1.1rem",
    py: 1.5,
} as const;
