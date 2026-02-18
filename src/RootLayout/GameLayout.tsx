import { Login as LoginIcon, Menu as MenuIcon } from "@mui/icons-material";
import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import type React from "react";
import { Outlet } from "react-router";

export function GameLayout(): React.ReactElement {
    return (
        <>
            <AppBar position="fixed" sx={{ display: { xs: "block", md: "block" }, zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2, display: { xs: "block", md: "none" } }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Stella Garden
                    </Typography>
                    <IconButton size="large" edge="end" color="inherit" aria-label="account">
                        <LoginIcon sx={{ width: 32, height: 32 }} />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Box sx={{ display: "flex" }}>
                <Outlet />
            </Box>
        </>
    );
}
