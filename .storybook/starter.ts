import { load } from "js-yaml";

import {
  aboutSchema,
  communitySchema,
  contactSchema,
  eventsFileSchema,
  faqSchema,
  formsSchema,
  getInvolvedSchema,
  jumuahSchema,
  musallahSchema,
  newslettersSchema,
  prayerSchema,
  resourcesSchema,
  supportSchema,
} from "../src/lib/content/schemas";
import about from "../content/about.yaml?raw";
import community from "../content/community.yaml?raw";
import contact from "../content/contact.yaml?raw";
import events from "../content/events.yaml?raw";
import faq from "../content/faq.yaml?raw";
import forms from "../content/forms.yaml?raw";
import getInvolved from "../content/get-involved.yaml?raw";
import jumuah from "../content/jumuah.yaml?raw";
import musallah from "../content/musallah.yaml?raw";
import newsletters from "../content/newsletters.yaml?raw";
import prayer from "../content/prayer.yaml?raw";
import resources from "../content/resources.yaml?raw";
import support from "../content/support.yaml?raw";

/**
 * Page text for stories: the starter text in content/*.yaml through the same
 * schemas as the site (PR5b), so no page sentence is copied into a story.
 */
export const starter = {
  about: aboutSchema.parse(load(about)),
  community: communitySchema.parse(load(community)),
  contact: contactSchema.parse(load(contact)),
  events: eventsFileSchema.parse(load(events)),
  faq: faqSchema.parse(load(faq)),
  forms: formsSchema.parse(load(forms)),
  "get-involved": getInvolvedSchema.parse(load(getInvolved)),
  jumuah: jumuahSchema.parse(load(jumuah)),
  musallah: musallahSchema.parse(load(musallah)),
  newsletters: newslettersSchema.parse(load(newsletters)),
  prayer: prayerSchema.parse(load(prayer)),
  resources: resourcesSchema.parse(load(resources)),
  support: supportSchema.parse(load(support)),
};
