# Work Log

## 2026-03-20

- Added cache-busting query versions to the static JS and CSS asset URLs so live deploys do not mix a new HTML shell with a stale cached app bundle, and skipped ESPN forecast requests for groups that are not forecast-eligible to avoid noisy `400` errors.
- Added persistent chart focus so clicking a line, callout, or legend name keeps one bracket highlighted until clicked again, with the rest of the field dimmed for easier tracking.
- Removed the duplicated top summary-card row so the chart-side live snapshot strip is the single place for scrub-aware snapshot stats.
- Reworked recent groups back into a bounded dropdown, kept the prominent group spotlight, and verified the dropdown can reopen previously viewed groups on mobile and desktop.
- Stabilized the chart cohort to the current top 10 for the selected metric so lines no longer pop in and out while scrubbing, and expanded the rank view so those lines stay visible even when they fell outside the top 10 earlier.
- Added a `Play from Start` replay control for a racing-lines playback from the opening board to the current snapshot.
- Fixed the `Leader Gap` wording so tied leaders read as `tied for 1st`, and made the accuracy gap view use percentage points instead of ESPN points.
- Replaced the manual EvanMiya CSV upload flow with built-in same-origin odds data, added a Playwright-based odds refresh script, and added a GitHub Actions workflow plus deploy support for the generated `data/` files.
- Tightened the site copy so the hero, status banner, empty states, picks area, and export language all read in the same editorial voice as the rest of the app.
- Reworked recent groups into visible quick-load buttons, added a session-storage fallback when persistent storage is restricted, and added a prominent hero spotlight for the currently loaded group name.
- Added an optional EvanMiya projection mode with CSV import, expected-score ranking for loaded brackets, local persistence for imported odds, and desktop/mobile QA against a live SportsCenter group.
- Kept the app static by using manual odds import instead of a brittle live scrape, since EvanMiya's tournament-odds page does not expose browser-readable CORS responses for GitHub Pages.
- Raised the compact chart height, added clearer keyboard focus states, and did another desktop and mobile smoke pass across chart scrubbing, mode toggles, round filtering, and recent-group selection.
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
- Added a display-only tie spread to the chart so brackets with the same score still render as distinct colored lines instead of collapsing into a single stroke.
- Reworked the chart labeling so larger layouts show all 10 tracked entries in the chart lane at once, with smaller layouts falling back to a fully visible 10-entry legend instead of a horizontal scroller.
- Restored lead-change and biggest-mover snapshot stats inside the chart strip, added visible game labels to the chart timeline ticks, and made scrub updates lighter by rerendering only snapshot-dependent sections on animation frames.
- Compressed the chart card header and live-snapshot strip so the graph appears sooner without removing the scrub-aware stats beside it.
- Removed the misleading public-group wording from the site copy and docs, since group links and IDs work regardless of ESPN's privacy label.
- Reworked the chart timeline ticks so the default labels are horizontal and sparser, and added readable game tooltips on hover, focus, and selection.
- Tightened the visual system to feel less generically generated: crisper paper cards, less blur, fewer pill shapes, and a more editorial hero and control treatment across desktop and mobile.

## 2026-03-19

- Built the first static version of Bracket Tracker.
- Added ESPN group loading, historical leaderboard reconstruction, points or accuracy toggle, leader graph, still-alive outlook, picks matrix, and CSV export.
- Verified that ESPN's Gambit API responds with CORS headers for a GitHub Pages origin.
- Added GitHub Pages deployment plumbing so pushes to `main` can publish the site.
- Reworked the leader chart labels to use a separate callout lane and richer legend metadata so crowded names are easier to read.
- Replaced the original hard-coded sample group with ESPN's featured SportsCenter group.
- Changed the chart to follow the current top 10 by ESPN points and added a chart-view toggle for rank vs point totals.
- Moved the scrubber into the chart card and added per-game markers so the graph itself can be scrubbed game by game.
- Changed the chart cohort to the selected moment's top 10 so scrubbing updates who is shown at each point in the tournament.
- Restructured the layout, made the chart responsive, cleaned up tie-heavy copy, and validated the result with desktop and mobile screenshots plus a headless DOM check.
- Added more snapshot stats, including lead margin, top-10 cutline, lead changes, and biggest mover, and tuned the summary grid to wrap earlier.
- Reworked the phone layout to feel more native, with swipeable summary cards, a compact chart toolbar, scrolling legend chips, safer touch spacing, and another desktop and mobile screenshot pass.
- Renamed the app to Bracket Tracker, changed the example button copy, kept chart colors stable by bracket across snapshots, added recent-group history in localStorage, and replaced mobile CSV export with a share-or-export-sheet fallback.
- Tried to cap large groups at 1000 loaded entries, then verified that ESPN's current group feed for the SportsCenter example only returns 100 entries even when asked for more, so the app now reports that limit honestly in the UI.
- Added direct pointer scrubbing on the chart plot area itself so dragging or tapping on the graph updates the selected snapshot without needing the lower slider.
- Relaxed the right-side callout packing again so leader labels get more vertical space and a slight stagger instead of reading as overlapping cards.
