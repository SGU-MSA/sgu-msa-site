import { resolveForm } from "@/lib/integrations";

import { FormCtaView, type FormCtaViewProps } from "./FormCtaView";

type FormCtaProps = Omit<FormCtaViewProps, "destination"> & {
  /** Key in the sign-up forms list. The URL itself never appears in JSX. */
  form: string;
};

/**
 * Renders a contribution CTA from a form key, on the server. A closed form,
 * or a missing or unsafe link, shows nothing — never a dead link
 * (`FormCtaView`).
 */
export async function FormCta({ form, ...props }: FormCtaProps) {
  return <FormCtaView destination={await resolveForm(form)} {...props} />;
}
