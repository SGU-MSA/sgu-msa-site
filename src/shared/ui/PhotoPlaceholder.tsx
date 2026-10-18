import { Camera } from "lucide-react";
import type { CSSProperties } from "react";

/** A shot brief, not a fake photograph. Shared by all design directions. */
export function PhotoPlaceholder({
  brief,
  fill,
  className = "",
  style,
}: {
  brief: string;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      role="img"
      aria-label={`Photo needed: ${brief}`}
      className={`photo-placeholder ${className}`}
      style={{
        ...(fill
          ? ({
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            } as const)
          : {}),
        ...style,
      }}
    >
      <span className="photo-frame" aria-hidden="true">
        <Camera size={22} aria-hidden="true" />
      </span>
      <span className="photo-label">Photograph to add</span>
      <span className="photo-brief">{brief}</span>
      <span className="photo-note">Your mosque. Your community.</span>
    </span>
  );
}
