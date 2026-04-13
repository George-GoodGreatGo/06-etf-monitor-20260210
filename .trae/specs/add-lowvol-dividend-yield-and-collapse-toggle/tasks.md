# Tasks
- [x] Task 1: Update API layer to return `dividendYieldPct`
  - [x] SubTask 1.1: Update `LowVolLatestSummary` type in `src/utils/marketApi.ts` to include `dividendYieldPct: number | null`
  - [x] SubTask 1.2: Update `getLowVolSummary` in `server/lib/lowVol.ts` to map `dividendYieldPct` from `last` to the `latest` response object.

- [x] Task 2: Update Home page index cards
  - [x] SubTask 2.1: In `src/pages/Home.tsx`, update `lowVolLatestByCode` type to include `dividendYieldPct`.
  - [x] SubTask 2.2: In `src/pages/Home.tsx`, update the API response mapping logic to extract `dividendYieldPct`.
  - [x] SubTask 2.3: In `src/pages/Home.tsx`, add a state `isCardsExpanded` (default `true`) and a toggle button "收起/展开" above the index cards grid.
  - [x] SubTask 2.4: In `src/pages/Home.tsx`, update the card rendering: display "股息率: X.XX%" next to the code; conditionally hide `opt.desc` and reduce padding when `!isCardsExpanded`.

- [x] Task 3: Update LowVolOpportunityPanel
  - [x] SubTask 3.1: In `src/components/LowVolOpportunityPanel.tsx`, add a new row in the summary stats box to display "股息收益率" and its value.

- [ ] Task 4: Refine dividend yield UI on index cards
  - [ ] SubTask 4.1: In `src/pages/Home.tsx`, render dividend yield as a tag/pill element (e.g. rounded-full, bordered, compact) rather than plain text.
