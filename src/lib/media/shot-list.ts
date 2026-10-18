/** Stable shot briefs replace inherited scaffold imagery; no guessed people or facilities. */
export function photoBrief(source = "") {
  if (/route|entrance/.test(source))
    return "The actual entrance and a recognizable wayfinding landmark";
  if (/prayer|musallah/.test(source))
    return "A wide, well-lit view of your prayer space";
  if (/merch|shukr/.test(source))
    return "Your actual merchandise, photographed clearly from front and back";
  if (/ramadan/.test(source))
    return "Your community sharing an iftar, with everyone’s permission";
  if (/board|portrait|headshot/.test(source))
    return "An approved portrait of your current board or volunteers";
  return "A welcoming group of your community outside the mosque, with consent";
}
