export function AvatarCell({
  src,
  name,
}: {
  src?: string | null;
  name: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)] text-[11px] font-semibold text-[var(--foreground)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
