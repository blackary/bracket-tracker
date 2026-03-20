# Work Log

## 2026-03-20

- Removed the confusing `Still Alive Today` summary card and left the dedicated win-outlook panel as the single place for current can-still-win status.
- Added a `Leader Gap` chart mode so the top-10 graph can be viewed relative to the current leader instead of only as raw points or rank.
- Rewrote the hero, metadata, and helper copy to sound like product copy instead of implementation notes, and added explicit share metadata for cleaner link previews.
- Split CSV exports into separate pick and result columns for each game, and made downloads default to all loaded rounds instead of the current table filter.
- Switched the picks matrix to use ESPN's full propositions catalog, so the round filter now exposes all six rounds and supports arbitrary multi-round combinations even before later games tip.
- Tightened the future-round picks table headers so later rounds show matchup labels plus possible-team counts instead of dumping every potential team into one column header.
- Tightened the app's visual direction with a darker hero treatment, stronger card surfaces, cleaner legend chips, and warmer chart and table panels so the page reads less like a generic dashboard.
- Added a short feature-pill row in the hero to give the landing area more structure without changing the app flow.
- Validated the styling pass against the live SportsCenter example in headless Chrome with fresh desktop and mobile screenshots plus a ready-state DOM check.
- Added a compact live snapshot strip inside the chart card so the key state stays visible beside the graph while scrubbing, and checked it on desktop and mobile with live interaction tests.

## 2026-03-19

- Built the first static version of Bracket Tracker.
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
- Renamed the app to Bracket Tracker, changed the example button copy, kept chart colors stable by bracket across snapshots, added recent-group history in localStorage, and replaced mobile CSV export with a share-or-export-sheet fallback.
- Tried to cap large groups at 1000 loaded entries, then verified that ESPN's current public group feed for the SportsCenter example only returns 100 entries even when asked for more, so the app now reports that limit honestly in the UI.
- Added direct pointer scrubbing on the chart plot area itself so dragging or tapping on the graph updates the selected snapshot without needing the lower slider.
- Relaxed the right-side callout packing again so leader labels get more vertical space and a slight stagger instead of reading as overlapping cards.
