import type { FieldProblems } from "./form-check/problems";

/**
 * The answer of a small form that has no boxes to mark (a tick, an archive
 * or restore button): the refusal, with any problem the save found, or the
 * notice. Board forms with boxes use `CheckedForm` instead, which shows each
 * problem on its box.
 */
export function FormMessages({
  error,
  fields,
  notice,
}: {
  error: string | null;
  fields?: FieldProblems;
  notice: string | null;
}) {
  const problems = Object.values(fields ?? {});
  return (
    <>
      {problems.length ? (
        <div role="alert" className="form-error">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
          {error ? <p>{error}</p> : null}
        </div>
      ) : error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="success-message">
          {notice}
        </p>
      ) : null}
    </>
  );
}
