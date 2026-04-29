export function ProgressBar({ value, max }: { value: number; max: number }) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    return (
        <div className="sg-progress-bar">
            <div className="sg-progress-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
    );
}
