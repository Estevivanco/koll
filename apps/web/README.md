# @koll/web

The website for Koll: a hero, a month overview with charts, a terminal where visitors ask questions, and a diagram of how the agents work together.

Right now it runs on **demo mode**: made-up data and scripted answers, so it needs no backend and spends no Gemini calls.

## Run it

```
npm run web                      # from the repo root, then open http://localhost:5173
npm run build -w @koll/web       # production build into apps/web/dist
```

## Folder structure

```
apps/web/
├── index.html            the page shell
├── vite.config.ts        build tool settings
└── src/
    ├── main.tsx          starts React
    ├── App.tsx           the page: header, sections in order, footer
    ├── api/              how the site gets answers (mock now, real backend later)
    ├── data/             the made-up demo numbers
    ├── lib/              small helpers with no UI (number formatting)
    ├── styles/           tokens.css (colors, type, spacing) and global.css (resets)
    ├── components/       reusable pieces used by more than one section
    │   ├── layout/       Header, Footer, Section, Container
    │   └── charts/       ChartCard, Sparkline
    └── features/         one folder per section of the page
        ├── hero/
        ├── overview/     filters, stat tiles, the two charts
        ├── terminal/     the chat box, built to look like a terminal
        └── how-it-works/ the agent diagram and the safeguards
```

Rule of thumb: if only one section uses it, it lives in that section's folder. When a second section needs it, move it to `components/`.

## Naming conventions

- **Folders:** `kebab-case`.
- **Components:** `PascalCase.tsx`, one component per file, named after the file. Named exports only (`export function Hero`), no default exports.
- **Styles:** `ComponentName.module.css` next to its component. Class names are `camelCase` (`styles.figureValue`).
- **Hooks:** `useSomething.ts`.
- **Everything else:** `camelCase.ts` (`format.ts`, `mockAsk.ts`).
- **Types:** next to the code that uses them. Shared ones go in the nearest `types.ts`.
- **Comments:** only where the reason is not obvious from the code.

## Design

Five colors, no gradients. Everything else is a tint made by mixing these in `styles/tokens.css`.

| Role | Color | Used for |
|---|---|---|
| Ink | `#0e1512` | page background |
| Paper | `#ece8dd` | text |
| Green | `#199e70` | primary accent: buttons, the prompt, chart data |
| Amber | `#c98500` | notices, the "demo data" badge, the Gemini marker |
| Blue | `#3987e5` | agents |

The chart colors were checked with the data-visualization palette validator (contrast, colorblind separation) against the card background `#161d19`. Chart rules used here:

- Bars for categories use one color. The names already say which is which.
- In the monthly chart the selected month is green and the rest are gray (emphasis, not a rainbow).
- Every chart has a table view, so no value depends on color or hovering.
- Tooltips work on hover and on keyboard focus.
- Motion is switched off for visitors who ask for reduced motion.

## Demo mode and the real backend

The terminal never knows where answers come from. It consumes a stream of events (`agents`, `route`, `sql`, `rows`, `answer`, ...) defined in `src/api/types.ts`.

- Today `src/api/index.ts` exports `ask = mockAsk`, which plays canned answers that follow the real agents' steps and wording.
- Later, point `ask` at a function that calls the orchestrator's `POST /ask` and yields the same events as they stream in. Nothing else needs to change.

All numbers on the page are invented. The real transactions never appear on the website.

## Not done yet

- The orchestrator is still a terminal script. It needs to become a server with `POST /ask` (streaming events).
- Before anything is public: a per-visitor rate limit, a length limit on questions, and a friendly message when the daily Gemini limit is reached.
- A light theme.
