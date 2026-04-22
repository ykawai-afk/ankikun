# Level avatars (30 characters)

Drop Midjourney renders into this folder with the filenames below and they
automatically appear on `/stats`. Missing files fall back to emoji — so if
you want to skip generating images for levels you'll never visit (e.g. the
first 4 infant tiers), that's fine.

## Shared style (paste into every prompt)

```
stylized 3D anime character, cel-shaded 3D render in the style of Arcane
and Spider-Verse, volumetric lighting, subtle rim light, soft ambient
occlusion, painterly textures on fabric and hair, detailed material
shading, expressive proportions, crisp clean outlines, pastel background
circle, full body character, centered composition, dynamic confident pose,
wholesome American setting
--ar 1:1 --style raw --v 6.1
```

**Specs**: 1024×1024 PNG. Transparent or bake in the pastel circle.

**Tips**:
- Use `--v 6.1` (not `--niji 6`) — niji flattens into 2D anime.
- **Don't use `--sref`**. Style-reference tends to carry over the reference
  character's face/age, so everyone turns into younger clones of the first
  result. The shared style block is already strong enough to hold the
  aesthetic across 30 prompts.
- Character diversity (ethnicity, hair, build) is baked into each prompt
  below so the 30 levels feel like 30 different Americans — not one person
  aging up.
- If you want even more Arcane polish, add `painterly brushwork, Fortiche
  studio style` to the per-character prompt.

## Recommended generation order

The user starts at ~8,000 words (level 5) and grows upward. Generate in this
priority:

1. **Current + next 5** (`second-grade-bookworm.png` → `middle-school-debater.png`) — these are what you'll actually see soon.
2. **Next 10** (`rebel-eighth-grader.png` → `liberal-arts-freshman.png`).
3. **The rest of the mid-band** (up to `corner-office-pro.png`).
4. **Aspirational tier** (`newsroom-editor.png` → `shakespearean-savant.png`).
5. **Pre-literacy nostalgia** (first 4) — optional, can stay as emoji.

## The 30 characters

### Pre-literacy (1–4)

**1. `babbling-baby.png` · 500 · The Babbling Baby**
`{shared} an American **East Asian baby boy (age 1), tufts of black hair**, in a onesie, mid-laugh with wide eyes, drooling slightly, holding up a rattle, soft peach circle background`

**2. `toddler-chatterbox.png` · 2,000 · The Toddler Chatterbox**
`{shared} an American **Black toddler girl (age 3) with little afro puffs**, mid-sentence with mouth wide open, animated gesture, striped shirt, juice box in hand, soft apricot circle background`

**3. `preschool-questioner.png` · 4,000 · The Preschool Questioner**
`{shared} an American **white girl (age 4) with strawberry-blonde curls**, one finger raised, giant question-mark speech bubble above head, oversized sweater, soft yellow circle background`

**4. `first-grade-storyteller.png` · 6,500 · The 1st Grade Storyteller**
`{shared} an American **Latino boy (age 6) with short curly brown hair**, sitting cross-legged telling a dramatic story, hands spread wide, picture book open at side, missing front tooth, soft lavender circle background`

### User's current territory (5–26)

**5. `second-grade-bookworm.png` · 8,000 · The 2nd Grade Bookworm**
`{shared} an American **East Asian girl (age 7) with twin braids and glasses**, oversized round glasses, hugging a stack of chapter books taller than torso, school uniform, tentative proud smile, soft mint circle background`

**6. `third-grade-daydreamer.png` · 9,500 · The 3rd Grade Daydreamer**
`{shared} an American **Black boy (age 8) with short twists**, staring up with dreamy smile, cloud-shaped thought bubbles around head, pencil tucked behind ear, sneakers untied, soft sky-blue circle background`

**7. `spelling-bee-rookie.png` · 11,000 · The Spelling Bee Rookie**
`{shared} an American **Latina girl (age 9) with long ponytail and ribbon**, at a microphone, contestant number pinned to sweater, spelling-bee stance, nervous smile, soft honey-yellow circle background`

**8. `nerdy-fifth-grader.png` · 12,500 · The Nerdy 5th Grader (ガリ勉)**
`{shared} an American **white boy (age 10), neat blonde side-part hair**, in preppy nerd outfit: button-up shirt, bow tie, suspenders, thick-rimmed glasses, calculator clipped to belt, raising one hand eagerly, confident valedictorian aura, soft cornflower-blue circle background`

**9. `sixth-grade-know-it-all.png` · 14,000 · The 6th Grade Know-It-All**
`{shared} an American **Indian-American boy (age 11) with tidy black side-part hair**, index finger raised to correct someone, smug slight smile, sweater vest over polo, textbook tucked under arm, soft sage-green circle background`

**10. `middle-school-debater.png` · 15,500 · The Middle School Debater**
`{shared} an American **mixed-race girl (age 12) with big natural afro puffs**, at a lectern with podium microphone, hand gesturing confidently, blazer over t-shirt, stack of index cards, soft slate-blue circle background`

**11. `rebel-eighth-grader.png` · 17,000 · The Rebel 8th Grader**
`{shared} an American **East Asian boy (age 13) with an undercut and bleached tips**, attitude pose, oversized hoodie partially hiding one eye, skateboard tucked under arm, wired earbuds dangling, ripped jeans, skeptical smirk, arms crossed, soft coral circle background`

**12. `freshman-overachiever.png` · 18,500 · The Freshman Overachiever**
`{shared} an American **Black girl (age 14) with long box braids**, juggling a heavy backpack, violin case, and sports gym bag, eager smile, varsity pin on lapel, soft lemon circle background`

**13. `ap-lit-sophomore.png` · 20,000 · The AP Lit Sophomore**
`{shared} an American **white girl (age 15) with dark brown hair in a messy half-bun**, reading a dense novel with pencil in mouth, headphones around neck, highlighter-streaked pages, soft plum circle background`

**14. `junior-editor.png` · 21,500 · The Junior Editor**
`{shared} an American **Latino boy (age 16) with short curly black hair**, school-newspaper editor holding a red marker and a proof sheet, press badge around neck, rolled-up sleeves, intense focused look, soft teal circle background`

**15. `varsity-valedictorian.png` · 23,000 · The Varsity Valedictorian**
`{shared} an American **Pacific Islander boy (age 17) with a long low ponytail**, in a letter jacket with big block letter, clutching a diploma and graduation cap, broad confident smile, academic medals around neck, soft gold circle background`

**16. `national-merit-finalist.png` · 24,500 · The National Merit Finalist**
`{shared} an American **East Asian girl (age 18) with a sleek bob cut**, on a stage receiving a plaque, gold medal hanging from neck, polished interview outfit, composed smile, soft champagne circle background`

**17. `liberal-arts-freshman.png` · 26,000 · The Liberal Arts Freshman**
`{shared} an American **Black boy (age 18) with a high-top fade**, in sweater and chinos on an ivy-covered campus, laptop bag over shoulder, stack of paperback classics, wide-eyed optimism, soft burgundy circle background`

**18. `english-major.png` · 27,500 · The English Major**
`{shared} an American **white boy (age 20) with round glasses and shoulder-length brown hair**, seated cross-legged reading Shakespeare, thick sweater, coffee thermos, annotated book in hand, soft olive circle background`

**19. `creative-writing-workshopper.png` · 29,000 · The Creative Writing Workshopper**
`{shared} an American **Latina woman (age 21) with long wavy chestnut hair**, manuscript in hand, pencil behind each ear, turtleneck, glasses, slightly pensive expression, soft dusty-rose circle background`

**20. `coffee-fueled-grad.png` · 30,500 · The Coffee-Fueled Grad**
`{shared} an American **white woman in her mid-20s, tired messy bun, freckles**, recent college grad pulling an all-nighter aftermath: rumpled graduation gown unbuttoned, giant to-go coffee cup, stack of printed papers, dark under-eye shadows, triumphant tired smile, soft beige circle background`

**21. `graduate-ta.png` · 32,000 · The Graduate TA**
`{shared} a **Black woman (age 24) with a natural afro**, American grad-school teaching assistant at a whiteboard mid-lecture, blazer over t-shirt, chalk in hand, clipboard under arm, soft mauve circle background`

**22. `phd-candidate.png` · 33,500 · The PhD Candidate**
`{shared} an American **East Asian woman (age 26) with short bob cut and glasses**, PhD candidate carrying a tottering stack of research papers, lab badge on belt, reading glasses pushed up into hair, determined expression, soft denim-blue circle background`

**23. `dissertation-survivor.png` · 35,000 · The Dissertation Survivor**
`{shared} an American **South Asian woman (age 28) with a long dark braid**, triumphantly holding up a bound dissertation overhead, confetti around, academic robe wrinkled, exhausted but elated face, soft lilac circle background`

**24. `postdoc-scholar.png` · 36,500 · The Post-Doc Scholar**
`{shared} an American **white man (age 30) with short beard and tortoiseshell glasses**, post-doc with clipboard and microscope, lab coat, intellectual focus, soft teal-green circle background`

**25. `tenured-professor.png` · 38,000 · The Tenured Professor**
`{shared} an American **Black man (age 45) with salt-and-pepper close-cropped hair**, tenured professor gesturing at a chalkboard full of literature notes, tweed blazer with elbow patches, reading glasses on chain, soft forest-green circle background`

**26. `corner-office-pro.png` · 40,000 · The Corner Office Pro**
`{shared} an American **East Asian man (late 20s) with a sharp modern haircut**, polished professional in business-casual: tailored blazer, crisp shirt unbuttoned at collar, laptop bag, premium coffee cup, confident boardroom stride, soft slate-grey circle background`

### Aspirational tier (27–30)

**27. `newsroom-editor.png` · 44,000 · The Newsroom Editor-in-Chief**
`{shared} an American **Latino man (age 40) with salt-and-pepper slicked-back hair**, editor-in-chief at a bustling newsroom desk, rolled-up shirt sleeves, red pen in hand, phone wedged between ear and shoulder, stacks of proofs, soft steel-blue circle background`

**28. `published-novelist.png` · 48,000 · The Published Novelist**
`{shared} an American **white woman (age 50) with long grey hair and a silk scarf**, novelist at a book signing, fountain pen in hand, stack of hardcover novels with dust jackets, thoughtful half-smile, soft ivory circle background`

**29. `lexicographer.png` · 55,000 · The Lexicographer**
`{shared} an American **Black man (age 55) with a close grey beard and round wire-rim glasses**, lexicographer at a tall wooden desk surrounded by massive dictionaries, archivist vest, magnifying glass in hand, soft sepia circle background`

**30. `shakespearean-savant.png` · 70,000 · The Shakespearean Savant**
`{shared} an American **white man (age 60) with long white flowing hair and white beard**, Shakespeare scholar in a flowing academic robe, First Folio under arm, quill poised over parchment, sage expression with twinkle in eye, soft royal-purple circle background`

## After placing files

```
git add public/levels/*.png
git commit -m "Add level avatar images"
git push
```

Vercel auto-deploys; `/stats` picks them up.
