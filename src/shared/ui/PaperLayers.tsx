import styles from "./paper.module.css";

/**
 * Two paper sheets layered behind a section (ADR 0018). Place it first inside
 * a positioned, overflow-clipped parent, and position the content after it
 * (for example `position: relative`) so it paints above the sheets. Never
 * behind scripture or dhikr text that would lose contrast: the sheets are
 * paper tones, not images.
 */
export function PaperLayers() {
  return (
    <>
      <div aria-hidden="true" className={styles.sheet} />
      <div aria-hidden="true" className={styles.sheetBack} />
    </>
  );
}
