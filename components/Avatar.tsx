// A coach's photo if they've uploaded one, otherwise their initials on a
// colored tile. Used everywhere a person is shown, so a new photo shows
// up across the whole site at once.
export function Avatar({
  name,
  photoUrl,
  className = "",
  style,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`avatar ${className}`}
        style={{ objectFit: "cover", ...style }}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`avatar ${className}`} style={style} aria-hidden="true">
      {initials}
    </div>
  );
}
