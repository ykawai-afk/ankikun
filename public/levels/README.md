# Level avatars

Drop Midjourney renders into this folder with the filenames below and they
automatically appear on `/stats`. Missing files fall back to emoji.

## Shared style (use in every prompt)

```
flat illustration, MBTI 16 personalities style, rounded geometric shapes,
clean line art, soft cel shading, soft pastel palette, single pastel
background circle, full body character, centered composition, wholesome
American children's book energy
--ar 1:1 --style raw --v 6.1
```

**Specs**: 1024×1024 PNG (transparent or with the pastel circle baked in).

## The 8 characters

### 1. toddler.png — The Curious Toddler · 2,000 words

```
{shared style}, an American toddler (age ~3) with wide curious eyes,
wearing onesie-style footie pajamas with star pattern, holding up a
half-eaten picture book, tufts of bedhead hair, soft peach circle
background
```

### 2. kindergartener.png — The Playground Rascal · 4,000 words

```
{shared style}, an American 5-year-old kindergartener with a scraped knee,
messy grin showing missing front tooth, oversized backpack with dangling
name tag, mid-run pose with one shoelace untied, soft lavender circle
background
```

### 3. second-grader.png — The Bookworm Beginner · 7,000 words

```
{shared style}, an American 2nd grader (age ~7) with oversized round
glasses slipping down nose, hugging a stack of picture books taller than
their torso, polo shirt tucked in too neatly, tentative proud smile, soft
mint circle background
```

### 4. fifth-grader.png — The Nerdy 5th Grader · 10,000 words (ガリ勉)

```
{shared style}, an American 5th grader (age ~10) in preppy nerd outfit:
button-up shirt, bow tie, suspenders, thick-rimmed glasses, a calculator
clipped to belt, raising one hand eagerly, arithmetic textbook under the
other arm, confident valedictorian aura, soft sky-blue circle background
```

### 5. eighth-grader.png — The Rebel Eighth Grader · 15,000 words

```
{shared style}, an American 8th grader (age ~13) with attitude: oversized
hoodie with hood up partially covering one eye, skateboard tucked under
arm, wired earbuds dangling, ripped jeans, skeptical smirk, arms crossed,
soft coral circle background
```

### 6. hs-senior.png — The Varsity Valedictorian · 20,000 words

```
{shared style}, an American high school senior (age ~18) wearing letter
jacket with big block letter, clutching a diploma and graduation cap,
broad confident smile, varsity gym bag over shoulder, academic medals
around neck, soft lemon-yellow circle background
```

### 7. college-grad.png — The Coffee-Fueled Grad · 30,000 words

```
{shared style}, an American recent college grad in their 20s pulling an
all-nighter aftermath: rumpled graduation gown unbuttoned, messy bun,
giant to-go coffee cup in one hand, stack of printed thesis papers in the
other, wide caffeinated eyes, dark under-eye shadows, triumphant tired
smile, soft rose circle background
```

### 8. professional.png — The Corner Office Pro · 40,000 words

```
{shared style}, a polished American professional (late 20s/early 30s) in
sharp business-casual: tailored blazer, crisp shirt unbuttoned at collar,
laptop bag over shoulder, premium coffee cup, confident boardroom stride,
slight eyebrow raise of quiet competence, soft slate-grey circle
background
```

## After placing the files

1. `git add public/levels/*.png`
2. Commit + push. Vercel auto-deploys and `/stats` picks them up — the
   emoji fallback inside `<LevelAvatar>` disappears as soon as the PNG
   exists at the expected path.
