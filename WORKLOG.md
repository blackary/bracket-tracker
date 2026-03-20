# Work Log

## 2026-03-19

- Built the first static version of Bracket Time Machine.
- Added ESPN group loading, historical leaderboard reconstruction, points or accuracy toggle, leader graph, still-alive outlook, picks matrix, and CSV export.
- Verified that ESPN's public Gambit API responds with CORS headers for a GitHub Pages origin.
- Added GitHub Pages deployment plumbing so pushes to `main` can publish the site.
- Reworked the leader chart labels to use a separate callout lane and richer legend metadata so crowded names are easier to read.
- Replaced the original hard-coded sample group with ESPN's featured SportsCenter public group.
- Changed the chart to follow the current top 10 by ESPN points and added a chart-view toggle for rank vs point totals.
- Moved the scrubber into the chart card and added per-game markers so the graph itself can be scrubbed game by game.
- Changed the chart cohort to the selected moment's top 10 so scrubbing updates who is shown at each point in the tournament.
- Restructured the layout, made the chart responsive, cleaned up tie-heavy copy, and validated the result with desktop and mobile screenshots plus a headless DOM check.
- Added more snapshot stats, including lead margin, top-10 cutline, lead changes, and biggest mover, and tuned the summary grid to wrap earlier.
- Reworked the phone layout to feel more native, with swipeable summary cards, a compact chart toolbar, scrolling legend chips, safer touch spacing, and another desktop and mobile screenshot pass.
