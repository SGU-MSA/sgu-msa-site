import { SEAL_SPRITE, SEAL_VIEWBOX } from "./seal-art";
import styles from "./paper.module.css";

/**
 * The official seal (ADR 0018), coloured by the theme (light: the green ink
 * seal; dark: the lighter seal). The drawing is one cached file,
 * public/images/brand/seal-sprite.svg, generated from seal.svg by
 * `node scripts/seal-art.mjs` (review fixes PR-C): each shape takes its
 * colour from --seal-ink, --seal-mint and --seal-cream, which the <use>
 * passes in from the page. The <svg> box is the symbol's own size from 0 0;
 * the symbol places the art, so it is never shifted or clipped. With a
 * `label` it is an image; without one it is decoration.
 */
export function Seal({ size, label }: { size: number; label?: string }) {
  return (
    <span className={styles.seal} style={{ width: size, height: size }}>
      <svg
        viewBox={SEAL_VIEWBOX}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
      >
        <use href={SEAL_SPRITE} />
      </svg>
    </span>
  );
}
