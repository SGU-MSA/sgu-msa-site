# Photograph your actual community

Inherited scaffold photographs are not displayed. Their current static files remain in `public/` so the reviewed site assets stay byte-for-byte unchanged; the interface shows specific shot briefs instead. A placeholder in the interface does not mean its source file is absent from Git. The obsolete POC concept images and source briefs are excluded from the clean public repository; their historical copies remain in the private-history repository. Do not reuse those originals without documented permission. Do not replace them with a stock mosque or AI-generated building that could be mistaken for yours.

## Ask the founder to take these pictures

| Shot | What to photograph | Where it will be used |
| --- | --- | --- |
| Entrance | The actual door, sign and recognizable surroundings, from a first-time visitor’s viewpoint | Home, Contact, Prayer/directions |
| Prayer space | A wide, well-lit interior, clear floor and entrance orientation; avoid photographing worshippers without consent | Prayer page and visit section |
| Community | A small welcoming group, naturally gathered, everyone consenting | Homepage/community introduction |
| Wayfinding | The verified starting landmark, turn/approach, and final entrance | Written directions gallery |
| Gathering | A real approved event, speaker or volunteers preparing, with permission | Events and news |
| Iftar | Your own approved iftar setup or gathering, not another mosque’s event | Ramadan |
| Board | Current individual portraits and/or a group portrait with approved names | About/board |
| Merchandise | Each actual item against a simple backdrop, front/back/detail, true color | Catalogue only; not checkout approval |

For each shot:

1. Clean the phone lens, use the normal camera (not a social-media screenshot), and take several landscape versions plus one portrait version.
2. Keep important faces/signage away from the edges so mobile crops work. Leave some breathing room around the subject.
3. Use daylight where possible; avoid extreme filters. Do not enlarge a tiny compressed image.
4. Check permission for every recognizable person, especially children; avoid sensitive scenes. Do not upload confidential notices, addresses on paperwork or personal contact details visible in the frame.
5. Write a one-sentence factual caption and record photographer, date, consent/rights approval and any restrictions privately.
6. Send originals through the club’s approved file-sharing channel. Suggested filenames: `entrance-wide`, `prayer-room-wide`, `community-group`, `wayfinding-01`, `merch-item-front`. Do not share passwords or unrelated phone galleries.

## Putting them on the site

Routine event/news cover images are uploaded through their board editor forms after the backend is configured. Accepted photos are validated and normalized to WebP; the original 3 MB upload limit applies. Add a useful image description, not “image.”

Static brand/entrance/editorial shots currently require the developer to approve/place the files under `public/images/approved/` and update their references in `content/` or the relevant photo slot. These static slots are **not yet a general admin media library**; do not promise that every homepage image is editable from the existing dashboard. If the board needs regular changes to these slots, add a small site-settings/media-slot editor before final handoff rather than asking them to edit JSX.

The shared `SafeImage` component shows a shot placeholder for all inherited sources. Newly approved `/images/approved/…` files and genuine backend `/media/…` uploads render normally. Do not turn the old images back on globally to replace one slot.

The map requires the exact verified entrance coordinates, not a photograph or an inferred campus centre. See the owner guide and prayer explainer for the distinct location decisions.
