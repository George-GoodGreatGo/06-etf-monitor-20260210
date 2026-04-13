# Tasks
- [ ] Task 1: Update API layer to return `dividendYieldPct`
  - [ ] SubTask 1.1: Update `LowVolLatestSummary` type in `src/utils/marketApi.ts` to include `dividendYieldPct: number | null`
  - [ ] SubTask 1.2: Update `getLowVolSummary` in `server/lib/lowVol.ts` to map `dividendYieldPct` from `last` to the `latest` response object.

- [ ] Task 2: Update Home page index cards
  - [ ] SubTask 2.1: In `src/pages/Home.tsx`, update `lowVolLatestByCode` type to include `dividendYieldPct`.
  - [ ] SubTask 2.2: In `src/pages/Home.tsx`, update the API response mapping logic to extract `dividendYieldPct`.
  - [ ] SubTask 2.3: In `src/pages/Home.tsx`, add a state `isCardsExpanded` (default `true`) and a toggle button "收起/展开" above the index cards grid.
  - [ ] SubTask 2.4: In `src/pages/Home.tsx`, update the card rendering: display "股息率: X.XX%" next to the code; conditionally hide `opt.desc` and reduce padding when `!isCardsExpanded`.

- [ ] Task 3: Update LowVolOpportunityPanel
  - [ ] SubTask 3.1: In `src/components/LowVolOpportunityPanel.tsx`, add a new row in the summary stats box to display "股息收益率" and its value.
