# Copy style

How the English on this profile is written: the README, HOW-IT-WORKS.md, the interactive page
(`pages/src/copy.json`) and the files made for it (the article, the portfolio PDF, the share
cards, the release notes). The rules come from the wording already there, so the pages read as
one person wrote them. Rules marked **(checked)** are checked by `python3 scripts/copy_check.py`;
facts (numbers, dates, names of things) are checked by `scripts/fact_check.py` against
`data/facts.json`, which is copied from 事实清单.md.

## Voice

- First person, plain and specific: "I decide what to build and how we'll know it works."
- Say what a thing does, then stop. No hype ("cutting-edge", "seamless", "revolutionary").
- Contractions are fine: I'm, we'll, doesn't.
- Only facts from 事实清单.md. A claim that is not there yet goes there first.

## Spelling: US English (checked)

| Write | Not |
|---|---|
| color, gray, behavior, favorite, honor | colour, grey, behaviour, favourite, honour |
| center, meter, fiber | centre, metre, fibre |
| organize, recognize, realize, optimize, analyze | organise, recognise, realise, optimise, analyse |
| license, defense | licence, defence |
| canceled, modeling, labeled, traveled | cancelled, modelling, labelled, travelled |
| fulfill, fulfillment, enroll | fulfil, fulfilment, enrol |
| catalog, program, judgment, aging | catalogue, programme, judgement, ageing |
| while, among, learned | whilst, amongst, learnt |
| toward, afterward, around the avatar | towards, afterwards, round the avatar (warning) |

## Punctuation

- **No em dash (—) or en dash (–) anywhere a visitor reads (checked).** Use a colon, a comma, a
  semicolon or parentheses. Ranges take "to": "12 to 110 seconds", "Oct to Nov 2026". A résumé
  date range keeps its spaced hyphen ("Mar 2026 - Present"), which the résumé check expects.
- A spaced hyphen is not a dash either (warning): "A - B" becomes "A: B" or "A, B".
- Straight quotes and apostrophes in English: ' and " (warning on ’ “ ”). Chinese keeps “” and 「」.
- A negative number takes the minus sign: "−15%". "800+" for "more than 800".
- No serial comma: "software, creative tech and product"; "Claude Code, Codex, Gemini, DeepSeek and Grok".
- Separators: " · " between short items, "↗" after a link that leaves the page, "→" for "go to".
- Ellipsis as one character (…), and only in interface text such as "Loading…".

## Times, dates and numbers

- Times: "8 PM", "1:59 AM", "Eastern Time" (warning on "8pm", "8 p.m.", "8PM").
- Dates: "November 8, 2026"; a month "Nov 2026"; ISO dates (2026-11-08) only in data and code.
- Small counts in words in running text ("eight planets", "two hours"); digits for measurements,
  times and anything over nine ("16 px", "172 cities", "12 to 110 seconds").

## Names (checked)

SilNest (声藏 in Chinese text), Storewright, StoreX, StoreX Chain, Claude Code, GitHub, GitHub
Actions, App Store, LinkedIn, JavaScript, TypeScript, Node.js, three.js, iPhone, iPad, macOS.
Never "Silnest", "StoreWright", "Claude code", "Github", "App store", "Appstore". Lowercase
`storewright` or `github.com` only as a repository name or an address.

On the README and the interactive page, Apple's phone system is named only as "iOS 17.0 or later",
and Android only in the tool name "Android Studio" in the interactive page's Uses (the user's
call, 2026-11-15; SilNest's Android version is not released). `make_readme.py` and
`pages/build.py` check this.

## Words that are not used (checked)

The banned block of 事实清单.md (`data/facts.json`, "banned"), for example "pipeline",
"workstation", "one-stop" and "published on". For AI Vocal's steps write "workflow". The duty
assistant's numbers (76.3%, 42.5%) always come with "duty assistant" and StoreX Chain, the
regional supply-chain part; never "store AI" (`fact_check.py` checks that).

## Headings and links

- Sentence case: "How I work", "Rotate my store", "Why the clock is right".
- A link says where it goes: "Open the live demo ↗", not "click here".
- Alt text: one or two sentences that say what the image shows and where it leads
  (`make_readme.py` checks the README's).

## Running the check

```bash
python3 scripts/copy_check.py              # README.md, HOW-IT-WORKS.md, the English in copy.json, the English deliverables
python3 scripts/copy_check.py --repo-only  # only this repository's files
python3 scripts/copy_check.py --report-only
```

Errors (dashes, spelling, names, banned words) make it exit 1; warnings only print.
