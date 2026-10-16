# Annam: design system

## Idea
Annam means food, or rice, in Malayalam. The interface is calm and clinical, and the plate is its one memorable element: when a meal is tagged, a plate diagram fills in segment by segment. Everything around it stays quiet.

## Colour tokens
| Token | Hex | Use |
| --- | --- | --- |
| `leaf` | `#2E6B47` | Primary actions, score ring, links |
| `leaf-deep` | `#183D2B` | Top bar, headings on light surfaces |
| `leaf-soft` | `#E3EEE6` | "On track" chips, quiet highlights |
| `rice` | `#F5F8F3` | App background |
| `ink` | `#17251E` | Body text |
| `muted` | `#5B6B62` | Secondary text |
| `line` | `#D6E1D8` | Borders and dividers |
| `turmeric` | `#E3A03A` | Diet and behaviour bars, focus ring, protein segment |
| `turmeric-soft` | `#FBEBD0` | "Needs attention" chips, flags |
| `chili` | `#C2492F` | Alerts and red flags only |
| `chili-soft` | `#F7DDD6` | "See your doctor" chips |

Plate segments: vegetables `#7DB06B`, protein and pulses `#E3A03A`, grains and millets `#E9DDC3`, fruit `#D8553F`, dairy `#CFE0F0`, untagged `#E9EEE9`.

Contrast: body text on `rice` and white meets WCAG AA. Never put white text on `turmeric`.

## Type
- Interface: Hanken Grotesk, weights 400, 500, 600 and 700.
- Wordmark: Noto Serif Malayalam 700, with "Annam" in Hanken Grotesk below it.
- Scale: 13, 14, 16 (body), 17, 21, 28 to 34 (page title). Line height 1.5 for body, 1.15 for titles.
- Line length under 80 characters for running text.

## Shape and space
- Radius: 8 px for inputs, 10 px for buttons, 14 px for panels, full for chips and the role switch.
- Spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Touch targets at least 44 px high on mobile.

## Components
| Component | Notes |
| --- | --- |
| Top bar | `leaf-deep` background, wordmark left, navigation right. Sticky. |
| Tabs | Patient sections: Overview, Measures, Plates, Weekly audit, Report. Underline for the current tab. Scrolls sideways on phones. |
| Panel | White, `line` border, 14 px radius. Not every block needs a panel. |
| Patient list | Rows, not cards. Name, programme day, score, status, last plate. |
| Status chip | On track (`leaf-soft`), Needs attention (`turmeric-soft`), See your doctor (`chili-soft`). Always with a reason nearby. |
| Score ring | 0 to 100, with change since baseline in points below the number. The only animated element; respect reduced motion. |
| Component bar | Label, points of maximum, and a thin bar. |
| Risk row | Name, chip with category and value, one line explaining the tool. |
| Plate graphic | Half circle vegetables, quarter protein and pulses, quarter grains and millets, two small circles for fruit and dairy. Untagged segments are pale. |
| Plate card | Meal, time, photo or plate graphic, tag chips, flag chips, score, comment. |
| Dialogs | For add patient, record visit, upload or review plate. Bottom sheet on phones. |
| Toast | Confirms an action using the same verb as the button. |
| Report | Print-friendly, with the wordmark, patient details, measures table, adherence, review, red flags, next step, approval. |

## Copy rules
- Sentence case everywhere. No all-caps labels and no decorative labels above headings.
- Name things by what users do: "Upload plate", "Record a visit", "Approve report".
- An action keeps its name: the "Upload plate" button produces the toast "Plate uploaded".
- Errors say what happened and how to fix it, without apologising.
- Empty states invite the next action: "No plates for this day. Upload a photo of each meal to start the log."
- Never use "reverse", "cure", "longevity", "biological age" or "remission" in patient-facing text.
- Patient-facing text is plain language. Malayalam translations come in a later release; keep all strings in one place.

## Accessibility
- WCAG 2.1 AA. Visible focus (turmeric ring). Every input labelled. Charts have text equivalents.
- Respect `prefers-reduced-motion`.
- Test at 390 px wide and at 200% zoom.
