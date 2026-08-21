import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import { getSponsorLogoGradient, getSponsorLogoInitial } from "@/lib/sponsorLogo";

export interface SponsorLogoFallbackProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "className"
> {
  name: string;
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
}

export function SponsorLogoFallback({
  name,
  src,
  alt = `${name} logo`,
  className = "h-full w-full",
  imageClassName = "h-full w-full object-contain",
  onError,
  ...imageProps
}: SponsorLogoFallbackProps) {
  const [isBroken, setIsBroken] = useState(!src);
  const gradient = useMemo(() => getSponsorLogoGradient(name), [name]);

  useEffect(() => {
    setIsBroken(!src);
  }, [src]);

  if (isBroken) {
    return (
      <div
        data-testid="sponsor-logo-fallback"
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center overflow-hidden ${className}`}
        style={{ background: gradient }}
      >
        <span className="select-none text-[clamp(2.75rem,10vw,6rem)] font-black leading-none text-white drop-shadow-md">
          {getSponsorLogoInitial(name)}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center overflow-hidden ${className}`}>
      <img
        {...imageProps}
        src={src}
        alt={alt}
        className={imageClassName}
        onError={(event) => {
          setIsBroken(true);
          onError?.(event);
        }}
      />
    </div>
  );
}
