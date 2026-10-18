import p from "./prayer.module.css";

type DirectionsProps = {
  heading: string;
  directions: string[];
  landmarkNote?: string | null;
};

/**
 * Written route steps from `content/musallah.yaml`, numbered in ink with a
 * hairline between steps.
 */
export function Directions({
  heading,
  directions,
  landmarkNote,
}: DirectionsProps) {
  return (
    <div>
      <h3 className={p.stepsLabel}>{heading}</h3>
      {directions.length ? (
        <ol className={p.steps}>
          {directions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : (
        <p className={p.footnote}>Written directions will be published here.</p>
      )}
      {directions.length && landmarkNote ? (
        <p className={p.landmark}>{landmarkNote}</p>
      ) : null}
    </div>
  );
}
