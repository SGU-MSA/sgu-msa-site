/**
 * The Google Forms how-to (PR5b D-13, D-25; the approved mockup
 * `forms-register`), shown beside the sign-up forms list. The steps follow
 * the mockup (step 4 is Google's tip 4, for when an event fills up; step 5
 * is tip 5, Link to Sheets); the tips are Google's built-in tips 1 and 2.
 * Not tip 3: it makes every visitor sign in to Google.
 */
const formsHowToSteps = [
  <>
    In Google Forms (signed in as the MSA Gmail), click{" "}
    <strong>Blank form</strong>. Add the questions you need. Ask only what you
    need.
  </>,
  <>
    Click <strong>Send → </strong>the link icon → tick{" "}
    <strong>Shorten URL → Copy</strong>.
  </>,
  <>
    In the dashboard, open the event and paste it into{" "}
    <strong>Sign-up link</strong>. Save. The event shows a “Sign up →” button.
  </>,
  <>
    Full? In the form’s <strong>Responses</strong> tab turn off{" "}
    <strong>Accepting responses</strong>. Optional: untick <strong>Open</strong>{" "}
    here too, or clear the event’s link.
  </>,
  <>
    Answers are in <strong>Responses → Link to Sheets</strong>. Delete them when
    the event is over.
  </>,
] as const;

const formsHowToTips = [
  <>
    Send each person a copy of their answers: in the form’s{" "}
    <strong>Settings → Responses</strong>, set{" "}
    <strong>Collect email addresses</strong> to <strong>Responder input</strong>{" "}
    and <strong>Send responders a copy of their response</strong> to{" "}
    <strong>Always</strong>.
  </>,
  <>
    Get an email in the MSA Gmail for each new answer: in the{" "}
    <strong>Responses</strong> tab, click <strong>⋮</strong> →{" "}
    <strong>Get email notifications for new responses</strong>.
  </>,
] as const;

/** The how-to card beside the sign-up forms list. */
export function FormsHowTo() {
  return (
    <aside className="content-card" aria-labelledby="forms-how-to">
      <h2 id="forms-how-to">How to: a Google Form for an event</h2>
      <ol className="help-steps">
        {formsHowToSteps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <h3 id="forms-tips">Tips</h3>
      <ul aria-labelledby="forms-tips">
        {formsHowToTips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>
    </aside>
  );
}
