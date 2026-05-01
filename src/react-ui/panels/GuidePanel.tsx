import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import guideContent from "../../../doc/23_USAGE.md?raw";
import { SidePanel } from "../components/SidePanel";

export interface GuidePanelProps {
    open: boolean;
    onClose: () => void;
}

export function GuidePanel({ open, onClose }: GuidePanelProps) {
    return (
        <div className={`sg-guide-panel${open ? " is-open" : ""}`}>
            <SidePanel open={open} title="プレイガイド" onClose={onClose}>
                <div className="sg-guide-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{guideContent}</ReactMarkdown>
                </div>
            </SidePanel>
        </div>
    );
}
