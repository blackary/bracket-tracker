# Bracket Time Machine

Static ESPN Tournament Challenge group tracker.

It loads a public group by id, reconstructs the group standings before every completed game, and lets you switch between:

- ESPN points
- Pick accuracy

It also shows:

- a leader history graph
- a timeline scrubber for completed games
- a bracket picks matrix with a round filter
- CSV export for the currently visible picks table
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
http://localhost:8000/?groupId=1d6c7953-500f-3673-b6f3-d7b11e8f32f3&season=2026
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
https://blackary.github.io/bracket-tracker/?groupId=1d6c7953-500f-3673-b6f3-d7b11e8f32f3&season=2026
```

## Notes

- This app uses ESPN’s public Gambit APIs directly from the browser.
- ESPN's API currently returns CORS headers that allow a GitHub Pages origin.
- Historical snapshots are reconstructed from completed propositions and public group picks.
- The late-round win outlook falls back to possible-max math until ESPN’s group forecast endpoint becomes available.
