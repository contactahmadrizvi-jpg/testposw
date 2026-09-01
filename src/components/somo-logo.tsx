import React from "react";

interface SomoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export function SomoLogo({ size = "md", showText = true, className = "" }: SomoLogoProps) {
  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const textSizes = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-xl",
  };

  const iconSize = sizeClasses[size];
  const textSize = textSizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Custom CSS Logo Icon */}
      <div className={`somo-logo-icon ${iconSize}`}>
        <div className="somo-logo-s">S</div>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-black text-foreground tracking-tight somo-brand-text ${textSize}`}>
            SOMO
          </span>
          <span className={`text-[0.65em] font-semibold text-muted-foreground uppercase tracking-wider somo-subtitle`}>
            Restaurant
          </span>
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
export function SomoLogoCompact({ size = "sm", className = "" }: Pick<SomoLogoProps, "size" | "className">) {
  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return (
    <div className={`somo-logo-icon ${sizeClasses[size]} ${className}`}>
      <div className="somo-logo-s">S</div>
    </div>
  );
}
