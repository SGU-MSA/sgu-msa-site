import { z } from "zod";
import { ruleMessage } from "./messages";

/**
 * The project's zod (review fixes P1, item 3): every schema is built from
 * this import, so the board's wording of a refusal (`ruleMessage`) is
 * installed wherever a schema runs: on the server, in the browser and in
 * scripts. `tests/validation-messages.test.ts` checks no other file imports
 * zod's runtime directly.
 */
z.config({ customError: ruleMessage });

export { z };
