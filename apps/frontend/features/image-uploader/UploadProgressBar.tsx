export function UploadProgressBar({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  return (
    <div
      className="h-1 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary transition-[width]"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  );
}
