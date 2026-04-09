type LogoVariant = "icon" | "full" | "white" | "mono";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
}

export default function Logo({
  variant = "full",
  className = "",
  priority = false,
}: LogoProps) {
  return (
    <img
      src={`/branding/logo-${variant}.svg`}
      alt="شعار نظام حجز القاعات"
      className={className}
      loading={priority ? "eager" : "lazy"}
      draggable={false}
    />
  );
}
