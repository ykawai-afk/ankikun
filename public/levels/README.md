# Level avatars

Drop Midjourney renders into this folder with the filenames below and they
automatically appear on `/stats`. Missing files fall back to emoji.

## File list

| File                       | Vocab | Label            | Character concept                    |
| -------------------------- | ----- | ---------------- | ------------------------------------ |
| `toddler.png`              |  2,000| Toddler          | American toddler in footie pajamas holding a stuffed bear |
| `kindergartener.png`       |  4,000| Kindergartener   | 5-year-old with an oversized backpack, gap-toothed grin |
| `second-grader.png`        |  7,000| 2nd Grader       | 7-year-old reading a picture book, star-patterned shirt |
| `fifth-grader.png`         | 10,000| 5th Grader       | 10-year-old with glasses, raising hand in class |
| `eighth-grader.png`        | 15,000| 8th Grader       | Middle-schooler in a hoodie with skateboard under arm |
| `hs-senior.png`            | 20,000| HS Senior        | High school senior holding a graduation cap, varsity jacket |
| `college-grad.png`         | 30,000| College Grad     | College grad in cap & gown, holding diploma, confetti |
| `professional.png`         | 40,000| Professional     | Professional in business-casual, coffee in hand, laptop bag |

## Style spec (applies to all 8)

- **Aspect**: 1:1 square, 1024×1024
- **Format**: PNG with transparent background (or solid pastel — see below)
- **Style**: MBTI 16Personalities-like — flat illustration, clean line art,
  soft pastel palette, rounded geometry, full-body character, slight cel
  shading
- **Background**: single soft pastel circle or rounded square (different
  hue per level is OK — the frame is already neutral)
- **Mood**: wholesome, friendly, American children's book energy

## Midjourney prompt template

```
Flat illustration of an American {AGE} {DESCRIPTION},
soft pastel palette, rounded shapes, clean line art,
full body character, single soft pastel {COLOR} circle background,
MBTI 16 personalities style, cel shading, wholesome mood,
centered composition, minimalist
--ar 1:1 --style raw --v 6.1
```

Fill in `{AGE}`, `{DESCRIPTION}`, `{COLOR}` per level. Keep the rest identical
so the 8 images feel like a set. Suggested colors:

- Toddler          → peach
- Kindergartener   → lavender
- 2nd Grader       → mint
- 5th Grader       → sky blue
- 8th Grader       → coral
- HS Senior        → lemon yellow
- College Grad     → rose
- Professional     → charcoal / slate

## After placing the files

1. `git add public/levels/*.png`
2. Commit + push. Vercel auto-deploys and `/stats` picks them up.
