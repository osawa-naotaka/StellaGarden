import { type ReactNode, useEffect } from "react";

export interface SidePanelProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
}

export function SidePanel({ open, title, onClose, children }: SidePanelProps) {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    return (
        <aside className={`sg-sidepanel${open ? " is-open" : ""}`} aria-hidden={!open}>
            <header className="sg-sidepanel-header">
                <h2 className="sg-sidepanel-title">{title}</h2>
                <button type="button" className="sg-sidepanel-close" onClick={onClose} aria-label="Close">
                    ×
                </button>
            </header>
            <div className="sg-sidepanel-body">{children}</div>
        </aside>
    );
}
