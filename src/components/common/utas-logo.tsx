import Image from "next/image";

// Real UTAS mark (public/logo.png), portrait at native 345x500 — `size` sets
// the rendered height and width follows that aspect ratio, so the shield
// shape is never stretched.
const LOGO_ASPECT_RATIO = 345 / 500;

export function UtasLogo({
  size = 32,
  className,
  title = "UTAS",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt={title}
      width={Math.round(size * LOGO_ASPECT_RATIO)}
      height={size}
      className={className}
    />
  );
}
