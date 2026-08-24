export const IMPERIAL_PROMPT = `
Create one photorealistic edited photograph from the supplied photograph.

IDENTITY AND COMPOSITION — MUST NOT CHANGE:
- Preserve the exact identity, facial geometry, expression, age, skin texture,
  hairstyle, hairline and eye color of every person.
- Preserve the original pose, hands, body proportions, camera angle, crop,
  perspective, depth of field, lighting direction, shadows and background.
- Do not beautify, rejuvenate, reshape or replace the person.
- Do not add or remove people, fingers, jewelry already visible, or objects.

EDIT ONLY CLOTHING AND IMPERIAL HEADWEAR:
- Dress the main person in historically credible Russian Imperial court attire
  from approximately 1880–1910, selected naturally for their presentation.
- Masculine attire: a perfectly tailored dark emerald or deep navy Imperial
  Russian ceremonial military uniform, realistic wool and velvet, gold bullion
  embroidery, epaulettes, sash and restrained authentic orders.
- Feminine attire: an Imperial Russian court gown with a structured velvet
  bodice, silk sleeves, gold embroidery, pearls and a natural fabric drape.
- Add an elegant historically inspired Russian Imperial crown or small court
  kokoshnik appropriate to the attire. It must sit physically on the head,
  follow the skull angle, compress the hair slightly and cast a correct shadow.
- Fabric must wrap around the real body with believable folds, seams, tension,
  occlusion and contact shadows. Match the photograph's grain and color response.

The result must look like an untouched real camera photograph, not AI art,
not a costume sticker, not CGI and not a collage. No text, watermark, frame,
fantasy armor, oversized crown or theatrical plastic materials.
`.trim();
