# Bracket Tracker

Static ESPN Tournament Challenge group tracker.

It loads a public group by id, reconstructs the group standings before every completed game, and lets you switch between:

- ESPN points
- Pick accuracy

It also shows:

- a top-10 movement graph for the selected moment, with chart toggles for rank, point totals, or gap to the leader
- direct scrubbing across the chart itself, plus an in-chart game scrubber with a marker for every completed game
- expanded snapshot stats including lead margin, cutline, lead changes, and biggest mover
- a timeline scrubber for completed games
- an optional projected-finish view powered by imported EvanMiya tournament-odds CSV data
- a bracket picks matrix with a multi-round filter that includes future rounds
- CSV export for all loaded picks, with separate pick and result columns per game
- recent groups remembered in `localStorage`
- current still-alive paths using ESPN possible max
- ESPN win probabilities later in the tournament when the forecast feed becomes available

## Run locally

Serve the folder over HTTP:

```bash
cd /Users/zachary/projects/bracket-tracker
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## URL params

- `groupId`
- `season`

Example:

```text
http://localhost:8000/?groupId=6e682872-7e5f-3aa2-84bf-003cb6a630ae&season=2026
```

## GitHub Pages

This repo is set up to deploy the static site with GitHub Actions.

1. Push `main` to GitHub.
2. In the repository settings, set Pages to use `GitHub Actions` as the source if it is not already enabled.
3. After the workflow runs, the site will be available at:

```text
https://blackary.github.io/bracket-tracker/
```

Example with a group preloaded:

```text
https://blackary.github.io/bracket-tracker/?groupId=6e682872-7e5f-3aa2-84bf-003cb6a630ae&season=2026
```

## Notes

- This app uses ESPN’s public Gambit APIs directly from the browser.
- ESPN's API currently returns CORS headers that allow a GitHub Pages origin.
- The built-in example button loads ESPN's featured `SportsCenter` public group for the 2026 tournament.
- Historical snapshots are reconstructed from completed propositions and public group picks.
- EvanMiya tournament odds are imported by CSV rather than fetched live, so the app stays compatible with a static GitHub Pages deploy.
- The imported projection ranks entries by expected remaining ESPN points from the EvanMiya round-advance odds. It is a projection overlay, not a full joint bracket simulation.
- Large groups ask ESPN for up to `1000` entries, but ESPN’s public group feed may return fewer. As of March 20, 2026, the `SportsCenter` example group returned `100` public entries.
- CSV export uses native share when possible on mobile and otherwise falls back to an in-app export sheet with save, open, and copy actions.
- CSV downloads include all loaded rounds by default, even if the on-page picks table is filtered to a subset of rounds.
- The late-round win outlook falls back to possible-max math until ESPN’s group forecast endpoint becomes available.
