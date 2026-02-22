import { Box } from "@mui/material";
import type React from "react";
import { Outlet } from "react-router";

export function GameLayout(): React.ReactElement {
    return (
        <Box sx={{ display: "flex" }}>
            <Outlet />
        </Box>
    );
}
