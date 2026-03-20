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
