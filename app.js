const GAMBIT_BASE = "https://gambit-api.fantasy.espn.com/apis/v1";
const SAMPLE_GROUP = {
  groupId: "6e682872-7e5f-3aa2-84bf-003cb6a630ae",
  name: "Example group",
  season: 2026
};
const MAX_PAGE_SIZE = 200;
const MAX_LOADED_ENTRIES = 1000;
const MAX_RECENT_GROUPS = 8;
const MAX_CHART_LINES = 10;
const MAX_CHART_CALLOUTS = 4;
const METRIC_POINTS = "points";
const METRIC_ACCURACY = "accuracy";
const CHART_MODE_RANK = "rank";
const CHART_MODE_POINTS = "points";
const CHART_MODE_GAP = "gap";
const OUTLOOK_MODE_ESPN = "espn";
const OUTLOOK_MODE_PROJECTION = "projection";
const RECENT_GROUPS_STORAGE_KEY = "bracket-tracker/recent-groups/v1";
const IMPORTED_ODDS_STORAGE_KEY = "bracket-tracker/imported-odds/v1";
const LEADER_COLORS = [
  "#ba3a1b",
  "#204e7b",
  "#2d7b56",
  "#d3a14a",
  "#7b5a2e",
  "#b05f2b",
  "#4f6474",
  "#8f4130",
  "#5e7d2b",
  "#845f9c",
  "#2f6f7e",
  "#a84f61",
  "#5a6bb0",
  "#4f8651",
  "#9a6a2a",
  "#7f4ba0"
];
const TEAM_KEY_ALIASES = {
  byu: "brighamyoung",
  csub: "calstatebakersfield",
  gcu: "grandcanyon",
  lsu: "louisianastate",
  msst: "mississippistate",
  missst: "mississippistate",
  mississippi: "olemiss",
  olemiss: "olemiss",
  smu: "southernmethodist",
  stjohns: "saintjohns",
  sdst: "southdakotastate",
  texasam: "texasam",
  tcu: "texaschristian",
  ucla: "ucla",
  uconn: "connecticut",
  ucsd: "californiasandiego",
  unc: "northcarolina",
  uncw: "northcarolinawilmington",
  unlv: "nevadalasvegas",
  usc: "southerncalifornia",
  usu: "utahstate",
  vcu: "virginiacommonwealth"
};
let browserStorage;

const state = {
  chartMode: CHART_MODE_RANK,
  chartPointerId: null,
  exportSheetUrl: null,
  importedOdds: loadImportedOdds(),
  loading: false,
  metric: METRIC_POINTS,
  outlookMode: OUTLOOK_MODE_ESPN,
  picksRoundIds: [],
  season: getDefaultSeason(),
  recentGroups: loadRecentGroups(),
  rawInput: "",
  selectedIndex: 0,
  model: null
};

const dom = {
  exportSheet: document.getElementById("export-sheet"),
  exportSheetActions: document.getElementById("export-sheet-actions"),
  exportSheetClose: document.getElementById("export-sheet-close"),
  exportSheetNote: document.getElementById("export-sheet-note"),
  exportSheetPreview: document.getElementById("export-sheet-preview"),
  exportSheetTitle: document.getElementById("export-sheet-title"),
  chartPanel: document.getElementById("chart-panel"),
  chartSnapshotStrip: document.getElementById("chart-snapshot-strip"),
  chartScrubber: document.getElementById("chart-scrubber"),
  chartModeButtons: Array.from(document.querySelectorAll("[data-chart-mode]")),
  detailsPanel: document.getElementById("details-panel"),
  downloadCsvButton: document.getElementById("download-csv-button"),
  form: document.getElementById("group-form"),
  groupInput: document.getElementById("group-input"),
  heroGroupMeta: document.getElementById("hero-group-meta"),
  heroGroupName: document.getElementById("hero-group-name"),
  heroGroupSpotlight: document.getElementById("hero-group-spotlight"),
  leaderLegend: document.getElementById("leader-legend"),
  metricButtons: Array.from(document.querySelectorAll("[data-metric]")),
  oddsFileInput: document.getElementById("odds-file-input"),
  oddsStatus: document.getElementById("odds-status"),
  outlookPanel: document.getElementById("outlook-panel"),
  outlookModeButtons: Array.from(document.querySelectorAll("[data-outlook-mode]")),
  importOddsButton: document.getElementById("import-odds-button"),
  clearOddsButton: document.getElementById("clear-odds-button"),
  picksPanel: document.getElementById("picks-panel"),
  picksRoundFilter: document.getElementById("picks-round-filter"),
  picksRoundOptions: document.getElementById("picks-round-options"),
  picksRoundSummary: document.getElementById("picks-round-summary"),
  picksSummary: document.getElementById("picks-summary"),
  recentGroupsList: document.getElementById("recent-groups-list"),
  sampleButton: document.getElementById("sample-button"),
  seasonInput: document.getElementById("season-input"),
  standingsPanel: document.getElementById("standings-panel"),
  statusBanner: document.getElementById("status-banner"),
  summaryChanges: document.getElementById("summary-changes"),
  summaryCutline: document.getElementById("summary-cutline"),
  summaryDecided: document.getElementById("summary-decided"),
  summaryLeader: document.getElementById("summary-leader"),
  summaryMargin: document.getElementById("summary-margin"),
  summaryMover: document.getElementById("summary-mover"),
  summarySnapshot: document.getElementById("summary-snapshot"),
  timelineCaption: document.getElementById("timeline-caption"),
  timelineGame: document.getElementById("timeline-game"),
  timelineMarkers: document.getElementById("timeline-markers"),
  timelineNext: document.getElementById("timeline-next"),
  timelinePrev: document.getElementById("timeline-prev"),
  timelineRange: document.getElementById("timeline-range")
};

function getDefaultSeason() {
  return new Date().getFullYear();
}

function getBrowserStorage() {
  if (browserStorage !== undefined) {
    return browserStorage;
  }

  const candidates = [window.localStorage, window.sessionStorage];

  for (const candidate of candidates) {
    try {
      const testKey = "__bracket_tracker_storage_test__";
      candidate.setItem(testKey, "1");
      candidate.removeItem(testKey);
      browserStorage = candidate;
      return browserStorage;
    } catch (error) {
      // Try the next storage bucket.
    }
  }

  browserStorage = null;
  return browserStorage;
}

function loadRecentGroups() {
  try {
    const storage = getBrowserStorage();

    if (!storage) {
      return [];
    }

    const raw = storage.getItem(RECENT_GROUPS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(item => normalizeRecentGroup(item))
      .filter(Boolean)
      .slice(0, MAX_RECENT_GROUPS);
  } catch (error) {
    return [];
  }
}

function normalizeRecentGroup(value) {
  const groupId = String(value?.groupId || "").trim();
  const season = Number(value?.season);

  if (!groupId || !Number.isFinite(season)) {
    return null;
  }

  return {
    groupId,
    name: String(value?.name || groupId).trim() || groupId,
    season,
    viewedAt: String(value?.viewedAt || new Date().toISOString())
  };
}

function persistRecentGroups() {
  try {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    storage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(state.recentGroups));
  } catch (error) {
    // Ignore storage failures; the app still works without persistence.
  }
}

function loadImportedOdds() {
  try {
    const storage = getBrowserStorage();

    if (!storage) {
      return null;
    }

    const raw = storage.getItem(IMPORTED_ODDS_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return hydrateImportedOddsRecord(JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

function persistImportedOdds() {
  try {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    if (!state.importedOdds) {
      storage.removeItem(IMPORTED_ODDS_STORAGE_KEY);
      return;
    }

    storage.setItem(
      IMPORTED_ODDS_STORAGE_KEY,
      JSON.stringify({
        importedAt: state.importedOdds.importedAt,
        season: state.importedOdds.season,
        source: state.importedOdds.source,
        teams: state.importedOdds.teams
      })
    );
  } catch (error) {
    // Ignore storage failures; the app still works without persistence.
  }
}

function makeRecentGroupKey(groupId, season) {
  return `${season}::${groupId}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function getLookupFromUrl() {
  const url = new URL(window.location.href);
  const rawGroup = url.searchParams.get("groupId") || url.searchParams.get("group");
  const rawSeason = url.searchParams.get("season");
  return {
    group: rawGroup ? rawGroup.trim() : "",
    season: rawSeason ? Number(rawSeason) : getDefaultSeason()
  };
}

function parseGroupLookup(rawInput, rawSeason) {
  const trimmed = rawInput.trim();
  const season = Number(rawSeason) || getDefaultSeason();

  if (!trimmed) {
    throw new Error("Enter a group ID or an ESPN group URL.");
  }

  const directUuid = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  if (directUuid && trimmed === directUuid[0]) {
    return { groupId: directUuid[0], season };
  }

  try {
    const url = new URL(trimmed);
    const groupId = url.searchParams.get("id");
    const seasonMatch = url.pathname.match(/tournament-challenge-bracket-(\d{4})/i);

    if (!groupId) {
      throw new Error("The URL does not include a group id.");
    }

    return {
      groupId,
      season: seasonMatch ? Number(seasonMatch[1]) : season
    };
  } catch (error) {
    if (directUuid) {
      return { groupId: directUuid[0], season };
    }
  }

  throw new Error("Could not parse that value. Use a group ID or a full ESPN group URL.");
}

function updateUrl(groupId, season) {
  const url = new URL(window.location.href);
  url.searchParams.set("groupId", groupId);
  url.searchParams.set("season", String(season));
  window.history.replaceState({}, "", url);
}

function rememberRecentGroup(model) {
  const nextRecord = {
    groupId: model.group.id,
    name: model.group.name,
    season: model.challenge.season,
    viewedAt: new Date().toISOString()
  };

  state.recentGroups = [nextRecord, ...state.recentGroups.filter(group => makeRecentGroupKey(group.groupId, group.season) !== makeRecentGroupKey(nextRecord.groupId, nextRecord.season))]
    .slice(0, MAX_RECENT_GROUPS);
  persistRecentGroups();
  renderRecentGroups();
}

function renderRecentGroups() {
  if (!dom.recentGroupsList) {
    return;
  }

  const selectedKey =
    state.model?.group?.id && state.model?.challenge?.season
      ? makeRecentGroupKey(state.model.group.id, state.model.challenge.season)
      : "";

  if (!state.recentGroups.length) {
    dom.recentGroupsList.className = "recent-groups recent-groups--empty";
    dom.recentGroupsList.innerHTML = '<p class="recent-groups__empty">No recent groups yet</p>';
    return;
  }

  dom.recentGroupsList.className = "recent-groups";
  dom.recentGroupsList.innerHTML = state.recentGroups
    .map(group => {
      const value = makeRecentGroupKey(group.groupId, group.season);
      const shortId = group.groupId.slice(0, 8);
      const active = value === selectedKey;
      return `
        <button
          class="recent-group-button${active ? " recent-group-button--active" : ""}"
          type="button"
          data-recent-group="${escapeAttribute(value)}"
          aria-pressed="${active ? "true" : "false"}"
        >
          <span class="recent-group-button__name">${escapeHtml(group.name)}</span>
          <span class="recent-group-button__meta">${escapeHtml(`${group.season} • ${shortId}`)}</span>
        </button>
      `;
    })
    .join("");
}

function renderHeroGroupSpotlight(model) {
  if (!dom.heroGroupSpotlight || !dom.heroGroupName || !dom.heroGroupMeta) {
    return;
  }

  if (!model) {
    dom.heroGroupSpotlight.className = "hero-group hero-group--empty";
    dom.heroGroupName.textContent = "No group loaded";
    dom.heroGroupMeta.textContent = "Load a public ESPN Tournament Challenge group to start tracking its history.";
    return;
  }

  const entryCount = model.group.limited
    ? `${formatCompactNumber(model.group.loadedEntries)} shown of ${formatCompactNumber(model.group.size)} entries`
    : `${formatCompactNumber(model.group.size)} entries`;

  dom.heroGroupSpotlight.className = "hero-group";
  dom.heroGroupName.textContent = model.group.name;
  dom.heroGroupMeta.textContent = `${model.challenge.season} tournament • ${entryCount}`;
}

function setStatus(message, tone = "idle") {
  dom.statusBanner.className = `status-banner status-banner--${tone}`;
  dom.statusBanner.textContent = message;
}

function buildFilter(filters) {
  return JSON.stringify(filters);
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${GAMBIT_BASE}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    credentials: "omit",
    headers: {
      Accept: "application/json"
    },
    mode: "cors"
  });

  const text = await response.text();
  const payload = text ? safeParseJson(text) : {};

  if (!response.ok) {
    const reason =
      payload?.details?.[0]?.message ||
      payload?.messages?.[0] ||
      `Request failed with status ${response.status}.`;

    throw new Error(reason);
  }

  return {
    data: payload,
    headers: response.headers
  };
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(columns => columns.some(value => String(value ?? "").trim()));
}

function normalizeHeaderKey(value) {
  return String(value ?? "")
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTeamKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalizeTeamKey(value) {
  const normalized = normalizeTeamKey(value);
  return TEAM_KEY_ALIASES[normalized] || normalized;
}

function getOutcomeMatchKeys(team) {
  const keys = new Set();

  [team?.name, team?.abbrev].forEach(value => {
    const canonical = canonicalizeTeamKey(value);

    if (canonical) {
      keys.add(canonical);
    }
  });

  return [...keys];
}

function parsePercentageValue(value) {
  const normalized = String(value ?? "").replace(/%/g, "").trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed > 1 ? parsed / 100 : parsed;
}

function hydrateImportedOddsRecord(record) {
  const season = Number(record?.season);
  const teams = Array.isArray(record?.teams)
    ? record.teams
        .map(team => {
          const name = String(team?.name || "").trim();
          const seed = String(team?.seed ?? "").trim();
          const roundProbabilities = Object.fromEntries(
            Object.entries(team?.roundProbabilities || {})
              .map(([roundIndex, value]) => [Number(roundIndex), Number(value)])
              .filter(([, value]) => Number.isFinite(value))
          );

          if (!name || !Object.keys(roundProbabilities).length) {
            return null;
          }

          return {
            name,
            seed,
            roundProbabilities
          };
        })
        .filter(Boolean)
    : [];

  if (!Number.isFinite(season) || !teams.length) {
    return null;
  }

  const byKey = new Map();
  teams.forEach(team => {
    const canonical = canonicalizeTeamKey(team.name);

    if (!canonical) {
      return;
    }

    if (!byKey.has(canonical)) {
      byKey.set(canonical, []);
    }

    byKey.get(canonical).push(team);
  });

  return {
    byKey,
    importedAt: String(record?.importedAt || new Date().toISOString()),
    season,
    source: String(record?.source || "EvanMiya Tourney Odds"),
    teams
  };
}

function parseImportedOddsCsv(text, season) {
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    throw new Error("That CSV did not include any EvanMiya odds rows.");
  }

  const headerIndexByKey = new Map(rows[0].map((header, index) => [normalizeHeaderKey(header), index]));
  const requiredColumns = {
    team: headerIndexByKey.get("team"),
    seed: headerIndexByKey.get("seed"),
    round32: headerIndexByKey.get("round 32"),
    sweet16: headerIndexByKey.get("sweet 16"),
    elite8: headerIndexByKey.get("elite eight"),
    final4: headerIndexByKey.get("final four"),
    titleGame: headerIndexByKey.get("title game"),
    champ: headerIndexByKey.get("champ")
  };

  if (Object.values(requiredColumns).some(value => value === undefined)) {
    throw new Error("That file does not look like EvanMiya's tournament-odds export.");
  }

  const teams = rows
    .slice(1)
    .map(columns => {
      const name = String(columns[requiredColumns.team] || "").trim();

      if (!name) {
        return null;
      }

      const roundProbabilities = {
        1: parsePercentageValue(columns[requiredColumns.round32]),
        2: parsePercentageValue(columns[requiredColumns.sweet16]),
        3: parsePercentageValue(columns[requiredColumns.elite8]),
        4: parsePercentageValue(columns[requiredColumns.final4]),
        5: parsePercentageValue(columns[requiredColumns.titleGame]),
        6: parsePercentageValue(columns[requiredColumns.champ])
      };

      return {
        name,
        roundProbabilities,
        seed: String(columns[requiredColumns.seed] ?? "").trim()
      };
    })
    .filter(team => team && Object.values(team.roundProbabilities).some(value => value !== null));

  const hydrated = hydrateImportedOddsRecord({
    importedAt: new Date().toISOString(),
    season,
    source: "EvanMiya Tourney Odds",
    teams
  });

  if (!hydrated || hydrated.teams.length < 16) {
    throw new Error("The imported odds file did not contain enough team rows to use.");
  }

  return hydrated;
}

async function fetchChallenge(season) {
  const challengeKey = `tournament-challenge-bracket-${season}`;
  const response = await fetchJson(`/challenges/${challengeKey}`, {
    platform: "chui",
    view: "chui_default"
  });

  return response.data;
}

async function fetchPropositions(challengeId) {
  const response = await fetchJson(`/propositions/`, {
    challengeId,
    platform: "chui",
    view: "chui_default"
  });

  return Array.isArray(response.data) ? response.data : response.data?.propositions || response.data?.items || [];
}

async function fetchGroupPage(challengeId, groupId, offset = 0, limit = MAX_PAGE_SIZE) {
  const filter = buildFilter({
    filterSortId: { value: 0 },
    limit,
    offset
  });

  const response = await fetchJson(`/challenges/${challengeId}/groups/${groupId}`, {
    filter,
    platform: "chui",
    view: "chui_pagetype_group_picks"
  });

  return response.data;
}

async function fetchAllGroupEntries(challengeId, groupId, maxEntries = MAX_LOADED_ENTRIES) {
  const firstPage = await fetchGroupPage(challengeId, groupId, 0, MAX_PAGE_SIZE);
  const pages = [firstPage];
  const totalEntries = firstPage.size || firstPage.entries.length;
  const targetEntries = Math.min(totalEntries, maxEntries);
  let fetched = firstPage.entries.length;

  while (fetched < targetEntries) {
    const page = await fetchGroupPage(challengeId, groupId, fetched, Math.min(MAX_PAGE_SIZE, targetEntries - fetched));

    if (!page.entries.length) {
      break;
    }

    pages.push(page);
    fetched += page.entries.length;
  }

  const entries = pages.flatMap(page => page.entries).slice(0, targetEntries);

  return {
    ...firstPage,
    entries,
    size: totalEntries,
    loadedEntries: entries.length,
    requestedEntries: targetEntries,
    truncated: totalEntries > entries.length
  };
}

async function fetchForecast(challengeId, groupId, size) {
  const filter = buildFilter({
    limit: Math.min(size, MAX_PAGE_SIZE),
    offset: 0
  });

  try {
    const response = await fetchJson(`/challenges/${challengeId}/groups/${groupId}/forecast`, {
      filter,
      platform: "chui",
      view: "chui_group_forecast"
    });

    const data = response.data;

    if (!Array.isArray(data.entries)) {
      return {
        available: false,
        message:
          data?.details?.[0]?.message ||
          data?.messages?.[0] ||
          "ESPN forecast data is not available for this group yet."
      };
    }

    if (size > MAX_PAGE_SIZE) {
      const pages = [data];
      let fetched = data.entries.length;

      while (fetched < size) {
        const nextFilter = buildFilter({
          limit: MAX_PAGE_SIZE,
          offset: fetched
        });
        const nextResponse = await fetchJson(`/challenges/${challengeId}/groups/${groupId}/forecast`, {
          filter: nextFilter,
          platform: "chui",
          view: "chui_group_forecast"
        });

        if (!nextResponse.data.entries?.length) {
          break;
        }

        pages.push(nextResponse.data);
        fetched += nextResponse.data.entries.length;
      }

      return {
        available: true,
        entries: pages.flatMap(page => page.entries),
        message: ""
      };
    }

    return {
      available: true,
      entries: data.entries,
      message: ""
    };
  } catch (error) {
    return {
      available: false,
      message: error.message
    };
  }
}

function getMappingValue(mappings, type) {
  return (mappings || []).find(mapping => mapping.type === type)?.value || "";
}

function sortByDateAndDisplayOrder(left, right) {
  const leftDate = left.date || 0;
  const rightDate = right.date || 0;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return (left.displayOrder || 0) - (right.displayOrder || 0);
}

function normalizePropositions(challenge) {
  const scoringPeriodById = new Map((challenge.scoringPeriods || []).map(period => [period.id, period]));

  return (challenge.propositions || [])
    .filter(proposition => proposition.display)
    .map(proposition => {
      const possibleOutcomes = [...(proposition.possibleOutcomes || [])].sort(
        (left, right) => (left.matchupPosition || left.displayOrder || 0) - (right.matchupPosition || right.displayOrder || 0)
      );
      const scoringPeriod = scoringPeriodById.get(proposition.scoringPeriodId);

      return {
        actualOutcomeIds: proposition.actualOutcomeIds || [],
        id: proposition.id,
        date: proposition.date,
        displayOrder: proposition.displayOrder,
        gameUrl: getMappingValue(proposition.mappings, "URL_DESKTOP"),
        name: proposition.name,
        roundAbbrev: scoringPeriod?.abbrev || `R${proposition.scoringPeriodId}`,
        roundLabel: scoringPeriod?.label || `Round ${proposition.scoringPeriodId}`,
        scoringPeriodId: proposition.scoringPeriodId,
        status: proposition.status,
        teams: possibleOutcomes.map(outcome => ({
          abbrev: outcome.abbrev,
          id: outcome.id,
          name: outcome.name,
          seed: outcome.regionSeed,
          status: outcome.status
        }))
      };
    })
    .sort(sortByDateAndDisplayOrder);
}

function buildTeamByOutcomeId(challenge) {
  const teamByOutcomeId = new Map();

  (challenge.propositions || []).forEach(proposition => {
    (proposition.possibleOutcomes || []).forEach(outcome => {
      if (!outcome?.id || teamByOutcomeId.has(outcome.id)) {
        return;
      }

      teamByOutcomeId.set(outcome.id, {
        abbrev: outcome.abbrev,
        id: outcome.id,
        name: outcome.name,
        seed: outcome.regionSeed
      });
    });
  });

  return teamByOutcomeId;
}

function buildRounds(challenge, visiblePropositions) {
  const visibleCountByRoundId = visiblePropositions.reduce((result, proposition) => {
    if (proposition.scoringPeriodId > 0) {
      result.set(proposition.scoringPeriodId, (result.get(proposition.scoringPeriodId) || 0) + 1);
    }

    return result;
  }, new Map());

  return (challenge.scoringPeriods || [])
    .filter(period => Number(period.id) > 0)
    .sort((left, right) => left.id - right.id)
    .map(period => ({
      abbrev: period.abbrev || `R${period.id}`,
      gameCount: visibleCountByRoundId.get(period.id) || 0,
      id: period.id,
      label: period.label || `Round ${period.id}`,
      startDate: period.startDate || period.firstPropositionLockDate || 0,
      subLabel: period.subLabel || ""
    }));
}

function buildRoundGameCounts(rounds, totalPickCount, visiblePropositions) {
  const visibleCountByRoundId = visiblePropositions.reduce((result, proposition) => {
    if (proposition.scoringPeriodId > 0) {
      result.set(proposition.scoringPeriodId, (result.get(proposition.scoringPeriodId) || 0) + 1);
    }

    return result;
  }, new Map());
  const counts = rounds.map(round => visibleCountByRoundId.get(round.id) || 0);
  const assigned = counts.reduce((sum, count) => sum + count, 0);
  let remaining = Math.max(totalPickCount - assigned, 0);
  const missingRoundIndexes = counts.flatMap((count, index) => (count ? [] : [index]));

  if (!remaining || !missingRoundIndexes.length) {
    return counts;
  }

  const geometricGuess = Array.from({ length: missingRoundIndexes.length }, (_, index) => 2 ** (missingRoundIndexes.length - index - 1));

  if (geometricGuess.reduce((sum, count) => sum + count, 0) === remaining) {
    missingRoundIndexes.forEach((roundIndex, guessIndex) => {
      counts[roundIndex] = geometricGuess[guessIndex];
    });

    return counts;
  }

  missingRoundIndexes.forEach((roundIndex, missingIndex) => {
    const roundsLeft = missingRoundIndexes.length - missingIndex;
    const nextCount = roundsLeft === 1 ? remaining : Math.max(1, Math.floor(remaining / 2));

    counts[roundIndex] = nextCount;
    remaining -= nextCount;
  });

  return counts;
}

function buildPropositionCatalog(challenge, groupEntries) {
  const visiblePropositions = normalizePropositions(challenge).filter(proposition => proposition.scoringPeriodId > 0);
  const propositionById = new Map(visiblePropositions.map(proposition => [proposition.id, proposition]));
  const teamByOutcomeId = buildTeamByOutcomeId(challenge);
  const referenceEntry = [...(groupEntries || [])].sort(
    (left, right) => (right.picks?.length || 0) - (left.picks?.length || 0)
  )[0];
  const orderedPickIds = (referenceEntry?.picks || []).map(pick => pick.propositionId).filter(Boolean);
  const rounds = buildRounds(challenge, visiblePropositions);
  const roundGameCounts = buildRoundGameCounts(rounds, orderedPickIds.length, visiblePropositions);

  if (!orderedPickIds.length) {
    return {
      propositions: visiblePropositions,
      rounds: rounds.map((round, index) => ({
        ...round,
        gameCount: roundGameCounts[index] || round.gameCount || 0
      })),
      teamByOutcomeId
    };
  }

  const propositions = [];
  const seenIds = new Set();
  let pickIndex = 0;

  rounds.forEach((round, roundIndex) => {
    const gameCount = roundGameCounts[roundIndex] || 0;

    for (let gameIndex = 0; gameIndex < gameCount && pickIndex < orderedPickIds.length; gameIndex += 1, pickIndex += 1) {
      const propositionId = orderedPickIds[pickIndex];
      const knownProposition = propositionById.get(propositionId);

      if (knownProposition) {
        propositions.push({
          ...knownProposition,
          date: knownProposition.date || round.startDate || 0,
          roundAbbrev: round.abbrev,
          roundLabel: round.label,
          scoringPeriodId: round.id
        });
        seenIds.add(propositionId);
        continue;
      }

      propositions.push({
        actualOutcomeIds: [],
        date: round.startDate || 0,
        displayOrder: gameIndex + 1,
        gameUrl: "",
        id: propositionId,
        name: `Game ${gameIndex + 1}`,
        roundAbbrev: round.abbrev,
        roundLabel: round.label,
        scoringPeriodId: round.id,
        status: "PENDING",
        teams: []
      });
      seenIds.add(propositionId);
    }
  });

  visiblePropositions
    .filter(proposition => !seenIds.has(proposition.id))
    .sort(sortByDateAndDisplayOrder)
    .forEach(proposition => {
      propositions.push(proposition);
    });

  return {
    propositions,
    rounds: rounds.map((round, index) => ({
      ...round,
      gameCount: roundGameCounts[index] || round.gameCount || 0
    })),
    teamByOutcomeId
  };
}

function normalizeForecastMap(forecastEntries) {
  const map = new Map();

  (forecastEntries || []).forEach(entry => {
    const forecast = entry.forecast || {};
    const rankProbabilities = forecast.finalRankProbabilities || {};
    const toWinRaw = rankProbabilities["1"] ?? rankProbabilities[1] ?? 0;

    map.set(entry.id, {
      keyOutcomes: forecast.keyOutcomes || [],
      toWinPct: Number((Number(toWinRaw) * 100).toFixed(1)),
      winsByTiebreak: Boolean(forecast.winsByTiebreak),
      winningPermutations: forecast.winningPermutations ?? null
    });
  });

  return map;
}

function buildEntryModels(entries, completedProps, pointValueByPeriod, forecastMap, currentLeaderScore) {
  return entries.map(entry => {
    const picksByPropositionId = new Map();

    (entry.picks || []).forEach(pick => {
      picksByPropositionId.set(pick.propositionId, pick);
    });

    let points = 0;
    let correct = 0;
    let incorrect = 0;
    const series = [
      {
        accuracyPct: 0,
        correct,
        decided: 0,
        incorrect,
        points
      }
    ];

    completedProps.forEach(proposition => {
      const pick = picksByPropositionId.get(proposition.id);
      const result = pick?.outcomesPicked?.[0]?.result || "UNDECIDED";

      if (result === "CORRECT") {
        points += pointValueByPeriod.get(proposition.scoringPeriodId) || 0;
        correct += 1;
      } else if (result === "INCORRECT") {
        incorrect += 1;
      }

      const decided = correct + incorrect;

      series.push({
        accuracyPct: decided ? (correct / decided) * 100 : 0,
        correct,
        decided,
        incorrect,
        points
      });
    });

    const currentScore = entry.score || {};
    const record = currentScore.record || {};
    const forecast = forecastMap.get(entry.id) || null;

    return {
      currentAccuracyPct: currentScore.record ? percentage(record.wins, record.wins + record.losses) : series[series.length - 1].accuracyPct,
      currentPoints: currentScore.overallScore || 0,
      currentPossibleMax: currentScore.possiblePointsMax || 0,
      currentRank: currentScore.rank || 0,
      currentWins: record.wins || 0,
      currentLosses: record.losses || 0,
      forecast,
      id: entry.id,
      memberName: entry.member?.displayName || "Unknown member",
      name: entry.name || "Unnamed entry",
      percentilePct: Number(((currentScore.percentile || 0) * 100).toFixed(1)),
      picksByPropositionId,
      series,
      stillAlive: (currentScore.possiblePointsMax || 0) >= currentLeaderScore,
      tiebreakValue: entry.tiebreakAnswers?.[0]?.value ?? null
    };
  });
}

function percentage(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function buildModel(challenge, groupResponse, forecastResponse) {
  const pointValueByPeriod = new Map(
    Object.entries(challenge.defaultGroupSettings?.scoringSettings?.propPointsByPeriod || {}).map(([periodId, value]) => [
      Number(periodId),
      Number(value)
    ])
  );

  const propositions = normalizePropositions(challenge).filter(proposition => proposition.scoringPeriodId > 0);
  const propositionCatalog = buildPropositionCatalog(challenge, groupResponse.entries);
  const pickPropositions = propositionCatalog.propositions;
  const completedProps = propositions.filter(proposition => proposition.status === "COMPLETE");
  const currentLeaderScore = groupResponse.entries.reduce(
    (maxScore, entry) => Math.max(maxScore, entry.score?.overallScore || 0),
    0
  );
  const forecastMap = normalizeForecastMap(forecastResponse.available ? forecastResponse.entries : []);
  const entries = buildEntryModels(groupResponse.entries, completedProps, pointValueByPeriod, forecastMap, currentLeaderScore);
  const model = {
    challenge: {
      currentRound: challenge.currentScoringPeriod?.label || "",
      key: challenge.key,
      season: Number((challenge.key || "").slice(-4)) || state.season,
      title: challenge.name
    },
    completedProps,
    currentLeaderScore,
    entries,
    forecast: forecastResponse,
    group: {
      entriesPerMember: groupResponse.challengeSettings?.entriesPerMember || 0,
      forecastEligible: Boolean(groupResponse.forecastEligible),
      forecastTeamsRemaining: groupResponse.forecastEligibleTeamsRemaining || null,
      apiLimited: Boolean(groupResponse.truncated && (groupResponse.loadedEntries || 0) < (groupResponse.requestedEntries || 0)),
      id: groupResponse.groupId,
      isLarge: Boolean(groupResponse.largeGroup),
      isLocked: Boolean(groupResponse.locked),
      limited: Boolean(groupResponse.truncated),
      loadedEntries: groupResponse.loadedEntries || groupResponse.entries.length,
      name: groupResponse.groupSettings?.name || groupResponse.groupId,
      public: Boolean(groupResponse.groupSettings?.public),
      requestedEntries: groupResponse.requestedEntries || groupResponse.entries.length,
      size: groupResponse.size || groupResponse.entries.length
    },
    pickPropositions,
    pointValueByPeriod,
    propositions,
    rounds: propositionCatalog.rounds,
    teamByOutcomeId: propositionCatalog.teamByOutcomeId
  };

  model.colorByEntryId = buildChartColorMap(model);

  return model;
}

function resolveImportedOddsTeam(importedOdds, team) {
  if (!importedOdds) {
    return null;
  }

  const directMatch = getOutcomeMatchKeys(team)
    .flatMap(key => importedOdds.byKey.get(key) || [])
    .find(Boolean);

  if (directMatch) {
    return directMatch;
  }

  const seed = String(team?.seed ?? "").trim();
  const normalizedNames = [team?.name, team?.abbrev]
    .map(value => canonicalizeTeamKey(value))
    .filter(Boolean);

  return importedOdds.teams.find(candidate => {
    const candidateKey = canonicalizeTeamKey(candidate.name);
    const seedMatch = !seed || !candidate.seed || seed === candidate.seed;

    return seedMatch && normalizedNames.some(key => key.includes(candidateKey) || candidateKey.includes(key));
  }) || null;
}

function buildImportedOddsProjection(model, importedOdds) {
  if (!importedOdds) {
    return null;
  }

  if (Number(importedOdds.season) !== Number(model.challenge.season)) {
    return {
      reason: `Imported odds are for ${importedOdds.season}, but this group is from ${model.challenge.season}.`
    };
  }

  const roundOrderById = new Map(model.rounds.map((round, index) => [Number(round.id), index + 1]));
  const oddsTeamByOutcomeId = new Map();
  let matchedTeams = 0;
  let unmatchedTeams = 0;

  model.teamByOutcomeId.forEach((team, outcomeId) => {
    const resolvedTeam = resolveImportedOddsTeam(importedOdds, team);

    if (resolvedTeam) {
      oddsTeamByOutcomeId.set(outcomeId, resolvedTeam);
      matchedTeams += 1;
      return;
    }

    unmatchedTeams += 1;
  });

  const pendingPropositions = model.pickPropositions.filter(proposition => proposition.status !== "COMPLETE");
  const standings = model.entries
    .map(entry => {
      let expectedRemainingPoints = 0;
      let matchedPicks = 0;
      let unresolvedPicks = 0;

      pendingPropositions.forEach(proposition => {
        const pick = entry.picksByPropositionId.get(proposition.id);
        const pickedOutcome = pick?.outcomesPicked?.[0];
        const roundOrder = roundOrderById.get(Number(proposition.scoringPeriodId));
        const teamOdds = pickedOutcome ? oddsTeamByOutcomeId.get(pickedOutcome.outcomeId) : null;
        const winProbability = teamOdds && roundOrder ? teamOdds.roundProbabilities[roundOrder] : null;

        if (typeof winProbability !== "number") {
          if (pickedOutcome) {
            unresolvedPicks += 1;
          }
          return;
        }

        matchedPicks += 1;
        expectedRemainingPoints += (model.pointValueByPeriod.get(Number(proposition.scoringPeriodId)) || 0) * winProbability;
      });

      return {
        coveragePct: matchedPicks + unresolvedPicks ? percentage(matchedPicks, matchedPicks + unresolvedPicks) : 100,
        currentPoints: entry.currentPoints,
        currentRank: entry.currentRank,
        entryId: entry.id,
        expectedRemainingPoints,
        matchedPicks,
        projectedPoints: entry.currentPoints + expectedRemainingPoints,
        unresolvedPicks
      };
    })
    .sort((left, right) => {
      if (left.projectedPoints !== right.projectedPoints) {
        return right.projectedPoints - left.projectedPoints;
      }

      if (left.expectedRemainingPoints !== right.expectedRemainingPoints) {
        return right.expectedRemainingPoints - left.expectedRemainingPoints;
      }

      if (left.currentPoints !== right.currentPoints) {
        return right.currentPoints - left.currentPoints;
      }

      return left.currentRank - right.currentRank;
    })
    .map((entry, index, entries) => ({
      ...entry,
      projectedBack: Math.max(entries[0].projectedPoints - entry.projectedPoints, 0),
      projectedRank: index + 1
    }));

  return {
    importedAt: importedOdds.importedAt,
    matchedTeams,
    reason: "",
    source: importedOdds.source,
    standings,
    teamsCoveredPct: matchedTeams + unmatchedTeams ? percentage(matchedTeams, matchedTeams + unmatchedTeams) : 100,
    unmatchedTeams
  };
}

function applyImportedOddsToModel(model) {
  model.oddsProjection = buildImportedOddsProjection(model, state.importedOdds);
}

function getSnapshotLabel(model, index) {
  const completedCount = model.completedProps.length;

  if (!completedCount) {
    return "No completed games yet";
  }

  if (index < completedCount) {
    return `Before ${model.completedProps[index].name}`;
  }

  return "Now";
}

function metricValue(snapshotEntry, metric) {
  return metric === METRIC_ACCURACY ? snapshotEntry.snapshot.accuracyPct : snapshotEntry.snapshot.points;
}

function valuesMatch(left, right, metric) {
  if (metric === METRIC_ACCURACY) {
    return Math.abs(left - right) < 0.0001;
  }

  return left === right;
}

function sortSnapshotEntries(entries, metric) {
  return [...entries].sort((left, right) => {
    const leftValue = metricValue(left, metric);
    const rightValue = metricValue(right, metric);

    if (!valuesMatch(leftValue, rightValue, metric)) {
      return rightValue - leftValue;
    }

    if (metric === METRIC_ACCURACY) {
      if (left.snapshot.points !== right.snapshot.points) {
        return right.snapshot.points - left.snapshot.points;
      }
    } else if (left.snapshot.correct !== right.snapshot.correct) {
      return right.snapshot.correct - left.snapshot.correct;
    }

    if (left.currentPossibleMax !== right.currentPossibleMax) {
      return right.currentPossibleMax - left.currentPossibleMax;
    }

    return left.name.localeCompare(right.name);
  });
}

function getSnapshotStandings(model, index, metric) {
  const snapshotEntries = model.entries.map(entry => ({
    ...entry,
    snapshot: entry.series[index]
  }));
  const sorted = sortSnapshotEntries(snapshotEntries, metric);
  let rank = 0;
  let previousValue = null;

  return sorted.map((entry, entryIndex) => {
    const value = metricValue(entry, metric);

    if (previousValue === null || !valuesMatch(value, previousValue, metric)) {
      rank = entryIndex + 1;
      previousValue = value;
    }

    return {
      ...entry,
      rank
    };
  });
}

function getChartEntries(model, snapshotIndex) {
  return getSnapshotStandings(model, snapshotIndex, METRIC_POINTS).slice(
    0,
    Math.min(model.entries.length, MAX_CHART_LINES)
  );
}

function buildChartColorMap(model) {
  const appearances = new Map();

  for (let snapshotIndex = 0; snapshotIndex <= model.completedProps.length; snapshotIndex += 1) {
    getChartEntries(model, snapshotIndex).forEach(entry => {
      const previous = appearances.get(entry.id);

      if (!previous) {
        appearances.set(entry.id, {
          appearances: 1,
          bestRank: entry.rank,
          entry,
          firstSeen: snapshotIndex
        });
        return;
      }

      previous.appearances += 1;
      previous.bestRank = Math.min(previous.bestRank, entry.rank);
      previous.firstSeen = Math.min(previous.firstSeen, snapshotIndex);
    });
  }

  const ordered = [...appearances.values()].sort((left, right) => {
    if (left.firstSeen !== right.firstSeen) {
      return left.firstSeen - right.firstSeen;
    }

    if (left.bestRank !== right.bestRank) {
      return left.bestRank - right.bestRank;
    }

    if (left.appearances !== right.appearances) {
      return right.appearances - left.appearances;
    }

    return left.entry.name.localeCompare(right.entry.name);
  });

  return new Map(ordered.map((item, index) => [item.entry.id, LEADER_COLORS[index % LEADER_COLORS.length]]));
}

function getLeaderSummary(standings, metric) {
  if (!standings.length) {
    return {
      entries: [],
      valueText: "-"
    };
  }

  const leadValue = metricValue(standings[0], metric);
  const leaders = standings.filter(entry => valuesMatch(metricValue(entry, metric), leadValue, metric));

  return {
    entries: leaders,
    valueText: metric === METRIC_ACCURACY ? `${leadValue.toFixed(1)}%` : `${leadValue} pts`
  };
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);
}

function formatGameCount(value) {
  const count = Number(value) || 0;
  return `${count} game${count === 1 ? "" : "s"}`;
}

function formatTeamCount(value) {
  const count = Number(value) || 0;
  return `${count} team${count === 1 ? "" : "s"}`;
}

function getLargeGroupNote(model) {
  if (!model.group.limited) {
    return "";
  }

  if (model.group.apiLimited) {
    return `This view includes the ${model.group.loadedEntries} entries ESPN currently makes available for this group.`;
  }

  return `This view uses the first ${model.group.loadedEntries} entries from this large group.`;
}

function formatShortDate(timestamp) {
  if (!timestamp) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
}

function truncateLabel(value, maxLength = 20) {
  const normalized = String(value ?? "").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1))}…`;
}

function getPicksHeaderDetails(proposition) {
  const namedTeams = proposition.teams.filter(team => team?.abbrev || team?.name);

  if (namedTeams.length === 2) {
    return {
      meta: formatShortDate(proposition.date),
      title: namedTeams.map(team => team.abbrev || team.name).join(" / ")
    };
  }

  return {
    meta: `${formatTeamCount(namedTeams.length)} possible • ${formatShortDate(proposition.date)}`,
    title: proposition.name
  };
}

function formatMetricDisplay(value, metric) {
  return metric === METRIC_ACCURACY ? `${value.toFixed(1)}%` : `${value} pts`;
}

function formatTieLabel(count) {
  return count > 1 ? `${count}-way tie` : "Leader";
}

function formatMarginDisplay(value, metric) {
  return metric === METRIC_ACCURACY ? `${value.toFixed(1)} pp` : `${value} pts`;
}

function formatProjectedPoints(value) {
  return `${value.toFixed(1)} pts`;
}

function formatExpectedRemainingPoints(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} expected`;
}

function formatRankDisplay(rank) {
  return rank ? `#${rank}` : "-";
}

function formatGapDisplay(value) {
  return `${value} back`;
}

function getChartModeValue(snapshotEntry, chartMode, leaderPoints = 0) {
  if (!snapshotEntry) {
    return null;
  }

  if (chartMode === CHART_MODE_RANK) {
    return snapshotEntry.rank;
  }

  if (chartMode === CHART_MODE_GAP) {
    return Math.max(leaderPoints - snapshotEntry.snapshot.points, 0);
  }

  return snapshotEntry.snapshot.points;
}

function formatChartValueDisplay(snapshotEntry, chartMode, leaderPoints = 0) {
  if (!snapshotEntry) {
    return "-";
  }

  if (chartMode === CHART_MODE_RANK) {
    return formatRankDisplay(snapshotEntry.rank);
  }

  if (chartMode === CHART_MODE_GAP) {
    return formatGapDisplay(getChartModeValue(snapshotEntry, chartMode, leaderPoints));
  }

  return `${snapshotEntry.snapshot.points} pts`;
}

function getLeadMarginSummary(standings, metric) {
  if (standings.length < 2) {
    return {
      detail: "Only one entry",
      valueText: "-"
    };
  }

  const leaders = getLeaderSummary(standings, metric).entries;

  if (leaders.length > 1) {
    return {
      detail: `${formatTieLabel(leaders.length)} at the top`,
      valueText: formatMarginDisplay(0, metric)
    };
  }

  const leadValue = metricValue(standings[0], metric);
  const runnerUp = standings.find(entry => !valuesMatch(metricValue(entry, metric), leadValue, metric));

  if (!runnerUp) {
    return {
      detail: "No runner-up yet",
      valueText: formatMarginDisplay(0, metric)
    };
  }

  return {
    detail: `over ${truncateLabel(runnerUp.name, 22)}`,
    valueText: formatMarginDisplay(leadValue - metricValue(runnerUp, metric), metric)
  };
}

function getTopTenCutlineSummary(model, snapshotIndex) {
  const pointsStandings = getSnapshotStandings(model, snapshotIndex, METRIC_POINTS);

  if (!pointsStandings.length) {
    return {
      detail: "No entries loaded",
      valueText: "-"
    };
  }

  const cutIndex = Math.min(MAX_CHART_LINES - 1, pointsStandings.length - 1);
  const cutlineEntry = pointsStandings[cutIndex];
  const nextEntry = pointsStandings[cutIndex + 1];
  let detail = pointsStandings.length < MAX_CHART_LINES ? `${pointsStandings.length} entries total` : "last chart spot";

  if (nextEntry) {
    const gap = cutlineEntry.snapshot.points - nextEntry.snapshot.points;
    detail = gap > 0 ? `${gap} pts over #11` : "tie at the cutline";
  }

  return {
    detail,
    valueText: `${cutlineEntry.snapshot.points} pts`
  };
}

function getLeadChangeCount(model, snapshotIndex, metric) {
  let previousLeaderKey = "";
  let changes = 0;

  for (let index = 0; index <= snapshotIndex; index += 1) {
    const standings = getSnapshotStandings(model, index, metric);
    const leaderKey = getLeaderSummary(standings, metric).entries
      .map(entry => entry.id)
      .sort()
      .join("|");

    if (previousLeaderKey && leaderKey !== previousLeaderKey) {
      changes += 1;
    }

    previousLeaderKey = leaderKey;
  }

  return changes;
}

function getBiggestMoverSummary(model, snapshotIndex, metric) {
  if (snapshotIndex === 0) {
    return {
      detail: "No prior game yet",
      valueText: "Opening tip"
    };
  }

  const previousStandings = getSnapshotStandings(model, snapshotIndex - 1, metric);
  const currentStandings = getSnapshotStandings(model, snapshotIndex, metric);
  const previousRanks = new Map(previousStandings.map(entry => [entry.id, entry.rank]));
  let biggestMove = null;

  currentStandings.forEach(entry => {
    const previousRank = previousRanks.get(entry.id) || entry.rank;
    const delta = previousRank - entry.rank;
    const score = Math.abs(delta);

    if (!biggestMove || score > biggestMove.score || (score === biggestMove.score && delta > biggestMove.delta)) {
      biggestMove = {
        delta,
        entry,
        score
      };
    }
  });

  if (!biggestMove || biggestMove.score === 0) {
    return {
      detail: "No rank movement",
      valueText: "Flat board"
    };
  }

  const direction = biggestMove.delta > 0 ? "up" : "down";
  const steps = Math.abs(biggestMove.delta);

  return {
    detail: `${direction} ${steps} spot${steps === 1 ? "" : "s"}`,
    valueText: truncateLabel(biggestMove.entry.name, 24)
  };
}

function layoutChartCallouts(callouts, minY, maxY, gap) {
  if (!callouts.length) {
    return [];
  }

  const laidOut = [...callouts]
    .sort((left, right) => left.targetY - right.targetY)
    .map((callout, index) => ({
      ...callout,
      y: Math.max(callout.targetY, minY + index * gap)
    }));

  for (let index = laidOut.length - 1; index >= 0; index -= 1) {
    const maxAllowed = maxY - (laidOut.length - 1 - index) * gap;
    laidOut[index].y = Math.min(laidOut[index].y, maxAllowed);
  }

  if (laidOut[0].y < minY) {
    laidOut[0].y = minY;

    for (let index = 1; index < laidOut.length; index += 1) {
      laidOut[index].y = Math.max(laidOut[index].y, laidOut[index - 1].y + gap);
    }
  }

  let previousY = -Infinity;
  let lane = 0;

  return laidOut.map(callout => {
    const crowded = callout.y - previousY < gap + 10;

    if (!crowded) {
      lane = 0;
    } else {
      lane = (lane + 1) % 2;
    }

    previousY = callout.y;

    return {
      ...callout,
      laneOffset: lane * 16
    };
  });
}

function buildChartPath(points) {
  let path = "";
  let drawing = false;

  points.forEach(point => {
    if (!point) {
      drawing = false;
      return;
    }

    path += `${drawing ? "L" : "M"}${point.x},${point.y} `;
    drawing = true;
  });

  return path.trim();
}

function getChartHitbox() {
  return dom.chartPanel.querySelector(".chart-hitbox");
}

function getChartSnapshotIndexFromClientX(clientX) {
  if (!state.model) {
    return null;
  }

  const hitbox = getChartHitbox();

  if (!hitbox) {
    return null;
  }

  const rect = hitbox.getBoundingClientRect();

  if (!rect.width) {
    return null;
  }

  const totalSnapshots = state.model.completedProps.length + 1;
  const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
  const ratio = (clampedX - rect.left) / rect.width;

  return Math.round(ratio * Math.max(totalSnapshots - 1, 0));
}

function renderLeaderBadgeList(entries, maxVisible = 5) {
  const visible = entries.slice(0, maxVisible);
  const overflow = entries.length - visible.length;

  return `
    <div class="timeline-game__leader-list">
      ${visible
        .map(
          entry => `
            <span class="timeline-game__leader-chip">${escapeHtml(entry.name)}</span>
          `
        )
        .join("")}
      ${
        overflow > 0
          ? `<span class="timeline-game__leader-chip timeline-game__leader-chip--muted">+${escapeHtml(overflow)} more</span>`
          : ""
      }
    </div>
  `;
}

function syncTimelineScrubber(model, snapshotIndex) {
  const completedCount = model ? model.completedProps.length : 0;
  const totalSnapshots = completedCount + 1;
  const caption =
    !model || !completedCount
      ? "No historical snapshots yet."
      : snapshotIndex === 0
        ? `Before ${model.completedProps[0].name} • 0 completed games were already in the book`
        : snapshotIndex < completedCount
          ? `After ${model.completedProps[snapshotIndex - 1].name} • Before ${model.completedProps[snapshotIndex].name}`
          : `Now after ${model.completedProps[completedCount - 1].name} • ${snapshotIndex} completed games were already in the book`;

  dom.timelineRange.max = String(completedCount);
  dom.timelineRange.value = String(snapshotIndex);
  dom.timelineRange.disabled = completedCount === 0;
  dom.timelinePrev.disabled = snapshotIndex <= 0;
  dom.timelineNext.disabled = snapshotIndex >= completedCount;
  dom.timelineCaption.textContent = caption;

  if (!model || totalSnapshots <= 1) {
    dom.timelineMarkers.innerHTML = '<span class="timeline-marker timeline-marker--empty"></span>';
    return;
  }

  dom.timelineMarkers.style.gridTemplateColumns = `repeat(${totalSnapshots}, minmax(0, 1fr))`;
  dom.timelineMarkers.innerHTML = Array.from({ length: totalSnapshots }, (_, index) => {
    const label =
      index === 0
        ? `Before ${model.completedProps[0].name}`
        : index < completedCount
          ? `After ${model.completedProps[index - 1].name} / before ${model.completedProps[index].name}`
        : `Now after ${model.completedProps[completedCount - 1]?.name || "the latest game"}`;

    return `
      <button
        class="timeline-marker ${index === snapshotIndex ? "is-active" : ""}"
        type="button"
        data-snapshot-index="${index}"
        aria-label="${escapeHtml(label)}"
        title="${escapeHtml(label)}"
      ></button>
    `;
  }).join("");
}

function getSelectedRounds(model) {
  if (!model) {
    return [];
  }

  const allRoundIds = model.rounds.map(round => String(round.id));
  const selectedRoundIds = [...new Set((state.picksRoundIds || []).map(String))].filter(roundId => allRoundIds.includes(roundId));

  if (!selectedRoundIds.length || selectedRoundIds.length >= allRoundIds.length) {
    state.picksRoundIds = allRoundIds;
    return model.rounds;
  }

  state.picksRoundIds = selectedRoundIds;
  return model.rounds.filter(round => selectedRoundIds.includes(String(round.id)));
}

function getRoundSelectionSummary(model) {
  if (!model || !model.rounds.length) {
    return "All rounds";
  }

  const selectedRounds = getSelectedRounds(model);

  if (selectedRounds.length === model.rounds.length) {
    return "All rounds";
  }

  if (selectedRounds.length === 1) {
    return selectedRounds[0].label;
  }

  if (selectedRounds.length === 2) {
    return `${selectedRounds[0].abbrev} + ${selectedRounds[1].abbrev}`;
  }

  return `${selectedRounds.length} rounds selected`;
}

function getPicksPropositions(model) {
  if (!model) {
    return [];
  }

  const selectedRoundIds = new Set(getSelectedRounds(model).map(round => String(round.id)));
  return model.pickPropositions.filter(proposition => selectedRoundIds.has(String(proposition.scoringPeriodId)));
}

function getPickState(model, entry, proposition) {
  const pick = entry.picksByPropositionId.get(proposition.id);
  const pickedOutcome = pick?.outcomesPicked?.[0];

  if (!pickedOutcome) {
    return {
      cssClass: "pick-chip--missing",
      csvLabel: "",
      csvStatus: "NO PICK",
      label: "—",
      status: "NO PICK",
      title: "No pick recorded"
    };
  }

  const team = proposition.teams.find(candidate => candidate.id === pickedOutcome.outcomeId) || model.teamByOutcomeId.get(pickedOutcome.outcomeId);
  const label = team?.abbrev || team?.name || "Pick";
  const status = pickedOutcome.result || "UNDECIDED";
  let cssClass = "pick-chip--undecided";

  if (status === "CORRECT") {
    cssClass = "pick-chip--correct";
  } else if (status === "INCORRECT") {
    cssClass = "pick-chip--incorrect";
  }

  return {
    cssClass,
    csvLabel: team?.name || label,
    csvStatus: status,
    label,
    status,
    title: `${team?.name || label} • ${status}`
  };
}

function syncPicksControls(model) {
  if (!dom.picksRoundFilter || !dom.picksRoundSummary || !dom.picksRoundOptions) {
    return;
  }

  if (!model) {
    dom.picksRoundFilter.open = false;
    dom.picksRoundSummary.textContent = "All rounds";
    dom.picksRoundSummary.setAttribute("aria-disabled", "true");
    dom.picksRoundOptions.innerHTML = '<p class="round-filter__empty">Load a group to choose rounds.</p>';
    dom.downloadCsvButton.disabled = true;
    return;
  }

  const selectedRounds = getSelectedRounds(model);
  const selectedRoundIdSet = new Set(selectedRounds.map(round => String(round.id)));

  dom.picksRoundSummary.textContent = getRoundSelectionSummary(model);
  dom.picksRoundSummary.removeAttribute("aria-disabled");
  dom.picksRoundOptions.innerHTML = `
    <div class="round-filter__actions">
      <button class="round-filter__action" type="button" data-round-action="all">All rounds</button>
    </div>
    <div class="round-filter__list">
      ${model.rounds
        .map(
          round => `
            <label class="round-filter__option">
              <input
                class="round-filter__checkbox"
                type="checkbox"
                value="${escapeAttribute(round.id)}"
                data-round-id="${escapeAttribute(round.id)}"
                ${selectedRoundIdSet.has(String(round.id)) ? "checked" : ""}
              />
              <span class="round-filter__option-copy">
                <span class="round-filter__option-label">${escapeHtml(round.label)}</span>
                <span class="round-filter__option-meta">${escapeHtml(`${formatGameCount(round.gameCount)}${round.subLabel ? ` • ${round.subLabel}` : ""}`)}</span>
              </span>
            </label>
          `
        )
        .join("")}
    </div>
  `;
  dom.downloadCsvButton.disabled = false;
}

function buildSnapshotSummary(model, standings, snapshotIndex) {
  const leaders = getLeaderSummary(standings, state.metric);
  const leadName = leaders.entries[0]?.name ? truncateLabel(leaders.entries[0].name, 26) : "-";
  const leaderDetail = leaders.entries.length
    ? `${formatTieLabel(leaders.entries.length)} • ${leaders.valueText}`
    : "-";
  const margin = getLeadMarginSummary(standings, state.metric);
  const cutline = getTopTenCutlineSummary(model, snapshotIndex);
  const leadChanges = getLeadChangeCount(model, snapshotIndex, state.metric);
  const biggestMover = getBiggestMoverSummary(model, snapshotIndex, state.metric);
  const snapshotLabel = getSnapshotLabel(model, snapshotIndex);

  return {
    biggestMover,
    completed: {
      detail: "completed games",
      valueText: `${snapshotIndex} of ${model.completedProps.length}`
    },
    cutline,
    leadChanges: {
      detail: `through ${snapshotLabel.toLowerCase()}`,
      valueText: String(leadChanges)
    },
    leader: {
      detail: leaderDetail,
      valueText: leadName
    },
    margin,
    snapshotLabel
  };
}

function renderSummary(summary) {
  dom.summarySnapshot.textContent = summary.snapshotLabel;
  dom.summaryLeader.innerHTML = `
    ${escapeHtml(summary.leader.valueText)}
    <div class="metric-card__detail">${escapeHtml(summary.leader.detail)}</div>
  `;
  dom.summaryDecided.textContent = summary.completed.valueText;
  dom.summaryMargin.innerHTML = `
    ${escapeHtml(summary.margin.valueText)}
    <div class="metric-card__detail">${escapeHtml(summary.margin.detail)}</div>
  `;
  dom.summaryCutline.innerHTML = `
    ${escapeHtml(summary.cutline.valueText)}
    <div class="metric-card__detail">${escapeHtml(summary.cutline.detail)}</div>
  `;
  dom.summaryChanges.innerHTML = `
    ${escapeHtml(summary.leadChanges.valueText)}
    <div class="metric-card__detail">${escapeHtml(summary.leadChanges.detail)}</div>
  `;
  dom.summaryMover.innerHTML = `
    ${escapeHtml(summary.biggestMover.valueText)}
    <div class="metric-card__detail">${escapeHtml(summary.biggestMover.detail)}</div>
  `;
}

function renderChartSnapshotStrip(summary) {
  const stripItems = [
    {
      detail: summary.completed.valueText,
      label: "Window",
      valueText: summary.snapshotLabel
    },
    {
      detail: summary.leader.detail,
      label: "Leader",
      valueText: truncateLabel(summary.leader.valueText, 20)
    },
    {
      detail: summary.completed.detail,
      label: "Games",
      valueText: summary.completed.valueText
    },
    {
      detail: summary.margin.detail,
      label: "Lead Margin",
      valueText: summary.margin.valueText
    },
    {
      detail: summary.cutline.detail,
      label: "Top 10 Cutline",
      valueText: summary.cutline.valueText
    }
  ];

  dom.chartSnapshotStrip.className = "snapshot-strip";
  dom.chartSnapshotStrip.innerHTML = `
    <div class="snapshot-strip__header">
      <div>
        <p class="snapshot-strip__eyebrow">Live Snapshot</p>
        <p class="snapshot-strip__copy">Keep the selected state in view while you scrub the chart.</p>
      </div>
      <span class="snapshot-strip__mode">${escapeHtml(state.metric === METRIC_ACCURACY ? "Accuracy view" : "ESPN points view")}</span>
    </div>
    <div class="snapshot-strip__items">
      ${stripItems
        .map(
          item => `
            <article class="snapshot-strip__item">
              <p class="snapshot-strip__label">${escapeHtml(item.label)}</p>
              <div class="snapshot-strip__value">${escapeHtml(item.valueText)}</div>
              <div class="snapshot-strip__detail">${escapeHtml(item.detail)}</div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTimeline(model, standings, snapshotIndex) {
  const completedCount = model.completedProps.length;

  if (!completedCount) {
    dom.timelineGame.className = "timeline-game timeline-game--empty";
    dom.timelineGame.textContent = "The tournament has not logged any completed games yet for this group.";
    return;
  }

  if (snapshotIndex >= completedCount) {
    const leaders = getLeaderSummary(standings, state.metric);
    const lastGame = model.completedProps[completedCount - 1];
    const leaderSummary =
      leaders.entries.length > 1
        ? `${formatTieLabel(leaders.entries.length)} for first at ${leaders.valueText}.`
        : `${leaders.entries[0]?.name || "Unknown entry"} leads at ${leaders.valueText}.`;

    dom.timelineGame.className = "timeline-game";
    dom.timelineGame.innerHTML = `
      <div>
        <p class="eyebrow">Current Standings</p>
        <h3 class="timeline-game__title">After ${escapeHtml(lastGame.name)}</h3>
      </div>
      <div class="timeline-game__meta">
        <span class="pill">${escapeHtml(lastGame.roundLabel)}</span>
        <span class="pill">${escapeHtml(formatDateTime(lastGame.date))}</span>
        <span class="pill pill--accent">${escapeHtml(leaders.valueText)}</span>
      </div>
      <div class="timeline-game__leaders">
        <p class="timeline-game__leaders-label">Top line right now</p>
        ${renderLeaderBadgeList(leaders.entries)}
      </div>
      <p class="timeline-game__copy">${escapeHtml(leaderSummary)}</p>
      ${
        lastGame.gameUrl
          ? `<a class="timeline-game__link" href="${escapeHtml(lastGame.gameUrl)}" target="_blank" rel="noreferrer">Open the last completed matchup on ESPN</a>`
          : ""
      }
    `;
    return;
  }

  const proposition = model.completedProps[snapshotIndex];
  const leaders = getLeaderSummary(standings, state.metric);
  const leaderSummary =
    leaders.entries.length > 1
      ? `${formatTieLabel(leaders.entries.length)} for first at ${leaders.valueText} before tip.`
      : `${leaders.entries[0]?.name || "Unknown entry"} led at ${leaders.valueText} before tip.`;

  dom.timelineGame.className = "timeline-game";
  dom.timelineGame.innerHTML = `
    <div>
      <p class="eyebrow">Pregame Snapshot</p>
      <h3 class="timeline-game__title">${escapeHtml(proposition.name)}</h3>
    </div>
    <div class="timeline-game__meta">
      <span class="pill">${escapeHtml(proposition.roundLabel)}</span>
      <span class="pill">${escapeHtml(formatDateTime(proposition.date))}</span>
      <span class="pill pill--accent">${escapeHtml(leaders.valueText)}</span>
    </div>
    <div class="timeline-game__teams">
      ${proposition.teams
        .map(
          team => `
            <div class="team-chip">
              <span class="team-chip__seed">${escapeHtml(team.seed || "-")}</span>
              <span>${escapeHtml(team.name)}</span>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="timeline-game__leaders">
      <p class="timeline-game__leaders-label">Top line before tip</p>
      ${renderLeaderBadgeList(leaders.entries)}
    </div>
    <p class="timeline-game__copy">${escapeHtml(leaderSummary)}</p>
    ${
      proposition.gameUrl
        ? `<a class="timeline-game__link" href="${escapeHtml(proposition.gameUrl)}" target="_blank" rel="noreferrer">Open matchup on ESPN</a>`
        : ""
    }
  `;
}

function renderChart(model, selectedIndex) {
  const totalSnapshots = model.completedProps.length + 1;
  const chartEntries = getChartEntries(model, selectedIndex);

  if (!chartEntries.length || totalSnapshots <= 1) {
    finishChartScrub();
    dom.chartPanel.className = "chart-panel chart-panel--empty";
    dom.chartPanel.textContent = "Load a group with completed games to render the top-10 chart.";
    dom.leaderLegend.innerHTML = "";
    return;
  }

  const chartEntryIds = new Set(chartEntries.map(entry => entry.id));
  const pointSnapshots = Array.from({ length: totalSnapshots }, (_, snapshotIndex) => {
    const standings = getSnapshotStandings(model, snapshotIndex, METRIC_POINTS);

    return {
      entriesById: new Map(standings.filter(entry => chartEntryIds.has(entry.id)).map(entry => [entry.id, entry])),
      leaderPoints: standings[0]?.snapshot.points ?? 0
    };
  });
  const currentPointsSnapshot = pointSnapshots[model.completedProps.length];
  const selectedPointsSnapshot = pointSnapshots[selectedIndex];
  const currentPointsStandings = currentPointsSnapshot.entriesById;
  const selectedPointsStandings = selectedPointsSnapshot.entriesById;
  const leaderEntries = chartEntries
    .map((entry, index) => ({
      color: model.colorByEntryId.get(entry.id) || LEADER_COLORS[index % LEADER_COLORS.length],
      entry
    }));

  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const compact = viewportWidth <= 820;
  const medium = viewportWidth <= 1200;
  const width = compact ? 760 : 980;
  const height = compact ? 360 : 360;
  const calloutLimit = compact ? 0 : medium ? 3 : MAX_CHART_CALLOUTS;
  const calloutGap = medium ? 50 : 54;
  const calloutHeight = 42;
  const padding = {
    top: 20,
    right: compact ? 24 : medium ? 224 : 238,
    bottom: compact ? 36 : 32,
    left: compact ? 34 : 42
  };
  const plotRight = width - padding.right;
  const chartWidth = plotRight - padding.left;
  const chartHeight = height - padding.top - padding.bottom;
  const maxPoints = Math.max(...leaderEntries.flatMap(({ entry }) => entry.series.map(snapshot => snapshot.points)), 1);
  const maxGap = Math.max(
    ...pointSnapshots.flatMap(snapshot =>
      leaderEntries.map(({ entry }) => {
        const snapshotEntry = snapshot.entriesById.get(entry.id);
        return snapshotEntry ? getChartModeValue(snapshotEntry, CHART_MODE_GAP, snapshot.leaderPoints) : 0;
      })
    ),
    1
  );
  const xStep = totalSnapshots > 1 ? chartWidth / (totalSnapshots - 1) : chartWidth;
  const xFor = index => padding.left + index * xStep;
  const gridValues =
    state.chartMode === CHART_MODE_RANK
      ? [1, 3, 5, 7, 10]
      : buildPointTicks(state.chartMode === CHART_MODE_GAP ? maxGap : maxPoints, state.chartMode === CHART_MODE_GAP ? 1 : 10);
  const yFor =
    state.chartMode === CHART_MODE_RANK
      ? value => padding.top + ((value - 1) / Math.max(MAX_CHART_LINES - 1, 1)) * chartHeight
      : state.chartMode === CHART_MODE_GAP
        ? value => padding.top + (value / Math.max(maxGap, 1)) * chartHeight
        : value => padding.top + chartHeight - (value / Math.max(maxPoints, 1)) * chartHeight;
  const selectionX = xFor(selectedIndex);
  const snapshotTickMarkup = Array.from({ length: totalSnapshots }, (_, index) => {
    const x = xFor(index);

    return `
      <line
        class="chart-snapshot-tick ${index === selectedIndex ? "chart-snapshot-tick--active" : ""}"
        x1="${x}"
        x2="${x}"
        y1="${height - padding.bottom}"
        y2="${height - padding.bottom + 10}"
      />
    `;
  }).join("");
  const calloutCandidates = leaderEntries
    .map(({ entry, color }) => {
      const selectedSnapshotEntry = selectedPointsStandings.get(entry.id);

      if (!selectedSnapshotEntry) {
        return null;
      }

      const selectedValue = getChartModeValue(selectedSnapshotEntry, state.chartMode, selectedPointsSnapshot.leaderPoints);

      if (selectedValue === null || (state.chartMode === CHART_MODE_RANK && selectedValue > MAX_CHART_LINES)) {
        return null;
      }

      const shortLabel = truncateLabel(entry.name, 18);
      const valueText = formatChartValueDisplay(selectedSnapshotEntry, state.chartMode, selectedPointsSnapshot.leaderPoints);

      return {
        color,
        currentX: xFor(selectedIndex),
        currentY: yFor(selectedValue),
        entryId: entry.id,
        label: shortLabel,
        labelWidth: Math.max(126, Math.min(180, Math.max(shortLabel.length * 7.2, valueText.length * 6.8) + 30)),
        sortValue:
          state.chartMode === CHART_MODE_RANK
            ? selectedSnapshotEntry.rank
            : state.chartMode === CHART_MODE_GAP
              ? selectedValue
              : -selectedSnapshotEntry.snapshot.points,
        targetY: yFor(selectedValue),
        valueText
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortValue - right.sortValue)
    .slice(0, calloutLimit);
  const callouts = layoutChartCallouts(
    calloutCandidates,
    padding.top + calloutHeight / 2,
    height - padding.bottom - calloutHeight / 2,
    calloutGap
  );
  const calloutMarkup = callouts
    .map(callout => {
      const labelX = plotRight + 18 + (callout.laneOffset || 0);
      const labelY = callout.y;
      const labelHeight = calloutHeight;
      const connectorMidX = Math.min(callout.currentX + 20, labelX - 12);

      return `
        <path
          class="chart-connector"
          d="M${callout.currentX + 6},${callout.currentY} L${connectorMidX},${callout.currentY} L${labelX - 10},${labelY} L${labelX},${labelY}"
          stroke="${callout.color}"
        />
        <g transform="translate(${labelX}, ${labelY - labelHeight / 2})">
          <rect
            class="chart-label-box"
            width="${callout.labelWidth}"
            height="${labelHeight}"
            rx="12"
            stroke="${callout.color}"
          />
          <circle cx="11" cy="${labelHeight / 2}" r="4.5" fill="${callout.color}" />
          <text class="chart-callout" x="22" y="15">${escapeHtml(callout.label)}</text>
          <text class="chart-callout-value" x="22" y="28">${escapeHtml(callout.valueText)}</text>
        </g>
      `;
    })
    .join("");

  dom.chartScrubber.style.setProperty("--plot-left", `${(padding.left / width) * 100}%`);
  dom.chartScrubber.style.setProperty("--plot-right", `${(padding.right / width) * 100}%`);
  syncTimelineScrubber(model, selectedIndex);

  dom.chartPanel.className = `chart-panel${compact ? " chart-panel--compact" : ""}`;
  dom.chartPanel.innerHTML = `
    <div class="chart-shell">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Leader history chart">
        ${gridValues
          .map(value => {
            const y = yFor(value);

            return `
              <line class="chart-grid-line" x1="${padding.left}" x2="${plotRight}" y1="${y}" y2="${y}" />
              <text class="chart-axis-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(
                state.chartMode === CHART_MODE_RANK ? formatRankDisplay(value) : String(value)
              )}</text>
            `;
          })
          .join("")}
        ${snapshotTickMarkup}
        <line class="chart-selection-line" x1="${selectionX}" x2="${selectionX}" y1="${padding.top}" y2="${height - padding.bottom}" />
        ${leaderEntries
          .map(({ entry, color }) => {
            const path = buildChartPath(
              Array.from({ length: totalSnapshots }, (_, snapshotIndex) => {
                const snapshot = pointSnapshots[snapshotIndex];
                const snapshotEntry = snapshot.entriesById.get(entry.id);

                if (!snapshotEntry) {
                  return null;
                }

                const chartValue = getChartModeValue(snapshotEntry, state.chartMode, snapshot.leaderPoints);

                if (chartValue === null || (state.chartMode === CHART_MODE_RANK && chartValue > MAX_CHART_LINES)) {
                  return null;
                }

                return {
                  x: xFor(snapshotIndex),
                  y: yFor(chartValue)
                };
              })
            );
            const selectedSnapshotEntry = selectedPointsStandings.get(entry.id);
            const selectedValue = getChartModeValue(selectedSnapshotEntry, state.chartMode, selectedPointsSnapshot.leaderPoints);

            return `
              ${path ? `<path class="chart-path" d="${path}" stroke="${color}" />` : ""}
              ${
                selectedValue !== null && !(state.chartMode === CHART_MODE_RANK && selectedValue > MAX_CHART_LINES)
                  ? `<circle class="chart-point" cx="${xFor(selectedIndex)}" cy="${yFor(selectedValue)}" r="5" fill="${color}" />`
                  : ""
              }
            `;
          })
          .join("")}
        <rect
          class="chart-hitbox"
          x="${padding.left}"
          y="${padding.top}"
          width="${chartWidth}"
          height="${chartHeight}"
          rx="16"
        />
        ${calloutMarkup}
      </svg>
    </div>
  `;

  dom.leaderLegend.innerHTML = leaderEntries
    .map(({ entry, color }) => {
      const currentSnapshotEntry = currentPointsStandings.get(entry.id);
      const selectedSnapshotEntry = selectedPointsStandings.get(entry.id);
      const currentValueText = formatChartValueDisplay(currentSnapshotEntry, state.chartMode, currentPointsSnapshot.leaderPoints);
      const selectedValueText = formatChartValueDisplay(selectedSnapshotEntry, state.chartMode, selectedPointsSnapshot.leaderPoints);
      const meta =
        selectedIndex === model.completedProps.length
          ? state.chartMode === CHART_MODE_RANK
            ? `Now ${currentValueText}`
            : `Now ${currentValueText} • ${formatRankDisplay(currentSnapshotEntry?.rank)}`
          : state.chartMode === CHART_MODE_RANK
            ? `Selected ${selectedValueText} • Now ${formatRankDisplay(currentSnapshotEntry?.rank)}`
            : `Selected ${selectedValueText} • Now ${currentValueText}`;

      return `
        <div class="legend__item">
          <span class="legend__dot" style="background:${color}"></span>
          <span class="legend__copy">
            <span class="legend__name">${escapeHtml(entry.name)}</span>
            <span class="legend__meta">${escapeHtml(meta)}</span>
          </span>
        </div>
      `
    })
    .join("");
}

function buildPointTicks(maxValue, minStep = 10) {
  const tickCount = 5;
  const step = Math.max(minStep, Math.ceil(maxValue / tickCount / minStep) * minStep);
  const ticks = [];

  for (let value = 0; value <= maxValue + step; value += step) {
    ticks.push(value);
  }

  return ticks.slice(0, tickCount + 1);
}

function renderStandings(model, standings) {
  if (!standings.length) {
    dom.standingsPanel.className = "table-wrap table-wrap--empty";
    dom.standingsPanel.textContent = "No standings available for this snapshot.";
    return;
  }

  dom.standingsPanel.className = "table-wrap";
  dom.standingsPanel.innerHTML = `
    <table class="standings-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Entry</th>
          <th>${state.metric === METRIC_POINTS ? "ESPN Points" : "Accuracy"}</th>
          <th>Correct</th>
          <th>Decided</th>
          <th>Current Max</th>
          <th>Live Path</th>
        </tr>
      </thead>
      <tbody>
        ${standings
          .map(entry => {
            const primaryMetric =
              state.metric === METRIC_POINTS
                ? `<strong>${entry.snapshot.points}</strong><span>${entry.snapshot.accuracyPct.toFixed(1)}% accurate</span>`
                : `<strong>${entry.snapshot.accuracyPct.toFixed(1)}%</strong><span>${entry.snapshot.points} ESPN points</span>`;

            return `
              <tr>
                <td class="standings-table__rank">${escapeHtml(entry.rank)}</td>
                <td>
                  <div class="standings-table__entry">
                    <span class="standings-table__entry-name">${escapeHtml(entry.name)}</span>
                    <span class="standings-table__entry-subtitle">${escapeHtml(entry.memberName)}</span>
                    ${entry.rank === 1 ? '<span class="badge badge--leader">Leader</span>' : ""}
                  </div>
                </td>
                <td>
                  <div class="standings-table__metric">
                    ${primaryMetric}
                  </div>
                </td>
                <td>${escapeHtml(entry.snapshot.correct)}</td>
                <td>${escapeHtml(entry.snapshot.decided)}</td>
                <td>${escapeHtml(entry.currentPossibleMax)} pts</td>
                <td>
                  ${
                    entry.stillAlive
                      ? '<span class="badge badge--alive">Still alive</span>'
                      : '<span class="badge badge--dead">Out</span>'
                  }
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function getActiveOutlookMode(model = state.model) {
  if (state.outlookMode === OUTLOOK_MODE_PROJECTION && model?.oddsProjection?.standings?.length) {
    return OUTLOOK_MODE_PROJECTION;
  }

  return OUTLOOK_MODE_ESPN;
}

function renderEspnOutlook(model) {
  const currentStandings = getSnapshotStandings(model, model.completedProps.length, METRIC_POINTS);
  const aliveEntries = currentStandings.filter(entry => entry.stillAlive);
  const rankedAlive = [...aliveEntries].sort((left, right) => {
    const leftForecast = left.forecast?.toWinPct ?? -1;
    const rightForecast = right.forecast?.toWinPct ?? -1;

    if (leftForecast !== rightForecast) {
      return rightForecast - leftForecast;
    }

    if (left.currentPossibleMax !== right.currentPossibleMax) {
      return right.currentPossibleMax - left.currentPossibleMax;
    }

    return right.currentPoints - left.currentPoints;
  });

  const leadScore = model.currentLeaderScore;
  const forecastAvailable = model.forecast.available;
  let forecastCopy = forecastAvailable
    ? "This view uses ESPN's current win odds for the loaded entries."
    : "This view uses current score and remaining possible points to show who still has a path to first.";

  if (model.group.limited) {
    forecastCopy += ` ${getLargeGroupNote(model)}`;
  }

  return `
    <p class="outlook-note">${escapeHtml(forecastCopy)}</p>
    <div class="stack-list">
      ${
        rankedAlive.length
          ? rankedAlive
              .slice(0, 8)
              .map(entry => {
                const behind = Math.max(leadScore - entry.currentPoints, 0);
                const forecastText = forecastAvailable
                  ? `${entry.forecast?.toWinPct?.toFixed(1) || "0.0"}% to win`
                  : `${entry.currentPossibleMax} max / ${behind} back`;

                return `
                  <div class="stack-list__item">
                    <p class="stack-list__kicker">ESPN outlook</p>
                    <div class="stack-list__title-row">
                      <span class="stack-list__title">${escapeHtml(entry.name)}</span>
                      <span class="stack-list__value">${escapeHtml(forecastText)}</span>
                    </div>
                    <p class="stack-list__meta">
                      ${escapeHtml(entry.memberName)} • ${escapeHtml(entry.currentPoints)} points now • ${escapeHtml(
                        `${entry.currentWins}-${entry.currentLosses}`
                      )} record
                    </p>
                  </div>
                `;
              })
              .join("")
          : `
            <div class="stack-list__item">
              <p class="stack-list__kicker">ESPN outlook</p>
              <div class="stack-list__title-row">
                <span class="stack-list__title">No live paths remain</span>
                <span class="stack-list__value">Finished</span>
              </div>
              <p class="stack-list__meta">
                No other loaded entry can still catch first place.
              </p>
            </div>
          `
      }
    </div>
  `;
}

function renderProjectionOutlook(model) {
  const projection = model.oddsProjection;

  if (!projection?.standings?.length) {
    const reason = projection?.reason || "Import an EvanMiya tournament-odds CSV to project the group finish.";

    return `
      <p class="outlook-note">${escapeHtml(reason)}</p>
      <div class="stack-list">
        <div class="stack-list__item">
          <p class="stack-list__kicker">Projection</p>
          <div class="stack-list__title-row">
            <span class="stack-list__title">Projection unavailable</span>
            <span class="stack-list__value">Waiting</span>
          </div>
          <p class="stack-list__meta">
            Import the public EvanMiya tournament-odds CSV to add projected finish scores for each loaded bracket.
          </p>
        </div>
      </div>
    `;
  }

  const projectedEntries = projection.standings
    .map(entry => ({
      ...entry,
      modelEntry: model.entries.find(candidate => candidate.id === entry.entryId)
    }))
    .filter(entry => entry.modelEntry);
  const note = `Projected finish uses imported EvanMiya round-advance odds as expected-value weights for each remaining pick. It is not a full bracket simulation. ${projection.teamsCoveredPct.toFixed(
    0
  )}% of bracket teams matched.`;

  return `
    <p class="outlook-note">${escapeHtml(note)}</p>
    <div class="stack-list">
      ${projectedEntries
        .slice(0, 8)
        .map(entry => {
          const projectedBack = entry.projectedBack <= 0.05 ? "Projected leader" : `${entry.projectedBack.toFixed(1)} back`;

          return `
            <div class="stack-list__item">
              <p class="stack-list__kicker">Projected finish</p>
              <div class="stack-list__title-row">
                <span class="stack-list__title">${escapeHtml(entry.modelEntry.name)}</span>
                <span class="stack-list__value">${escapeHtml(formatProjectedPoints(entry.projectedPoints))}</span>
              </div>
              <p class="stack-list__meta">
                ${escapeHtml(entry.modelEntry.memberName)} • ${escapeHtml(
                  formatExpectedRemainingPoints(entry.expectedRemainingPoints)
                )} • ${escapeHtml(projectedBack)} • ${escapeHtml(entry.matchedPicks)} future picks weighted
              </p>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderOutlook(model) {
  dom.outlookPanel.className = "outlook-panel";
  dom.outlookPanel.innerHTML = getActiveOutlookMode(model) === OUTLOOK_MODE_PROJECTION ? renderProjectionOutlook(model) : renderEspnOutlook(model);
}

function syncOutlookModeButtons() {
  const projectionAvailable = Boolean(state.model?.oddsProjection?.standings?.length);
  const activeMode = getActiveOutlookMode(state.model);

  dom.outlookModeButtons.forEach(button => {
    const mode = button.dataset.outlookMode;
    const active = mode === activeMode;
    const disabled = mode === OUTLOOK_MODE_PROJECTION && !projectionAvailable;

    button.classList.toggle("is-active", active);
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncImportedOddsUi() {
  if (!dom.oddsStatus || !dom.clearOddsButton || !dom.importOddsButton) {
    return;
  }

  const importedOdds = state.importedOdds;

  dom.clearOddsButton.hidden = !importedOdds;
  dom.clearOddsButton.disabled = !importedOdds;
  dom.importOddsButton.textContent = importedOdds ? "Replace Odds" : "Import Odds";

  if (!importedOdds) {
    dom.oddsStatus.textContent = "Import an EvanMiya tournament-odds CSV to add projected finish scores.";
    return;
  }

  if (state.model?.oddsProjection?.standings?.length) {
    dom.oddsStatus.innerHTML = `<strong>${escapeHtml(importedOdds.source)}</strong> loaded for ${escapeHtml(
      importedOdds.season
    )} • ${escapeHtml(formatTeamCount(importedOdds.teams.length))} imported`;
    return;
  }

  if (state.model?.oddsProjection?.reason) {
    dom.oddsStatus.textContent = state.model.oddsProjection.reason;
    return;
  }

  dom.oddsStatus.innerHTML = `<strong>${escapeHtml(importedOdds.source)}</strong> ready for ${escapeHtml(importedOdds.season)}.`;
}

function renderPicksTable(model) {
  syncPicksControls(model);

  if (!model) {
    dom.picksPanel.className = "table-wrap table-wrap--empty";
    dom.picksPanel.textContent = "The picks matrix will appear here.";
    dom.picksSummary.textContent = "Load a group to inspect bracket picks and export them as CSV.";
    return;
  }

  const propositions = getPicksPropositions(model);
  const currentStandings = getSnapshotStandings(model, model.completedProps.length, METRIC_POINTS);
  const selectedRounds = getSelectedRounds(model);
  const roundLabel =
    selectedRounds.length === model.rounds.length
      ? `all ${model.rounds.length} rounds`
      : selectedRounds.length === 1
        ? selectedRounds[0].label
        : `${selectedRounds.length} selected rounds`;
  const largeGroupNote = model.group.limited ? ` ${getLargeGroupNote(model)}` : "";

  dom.picksSummary.textContent = `Showing ${formatGameCount(propositions.length)} from ${roundLabel}. CSV export downloads all loaded rounds by default.${largeGroupNote}`;

  if (!propositions.length) {
    dom.picksPanel.className = "table-wrap table-wrap--empty";
    dom.picksPanel.textContent = "No picks are available for that round filter.";
    return;
  }

  dom.picksPanel.className = "table-wrap";
  dom.picksPanel.innerHTML = `
    <table class="picks-table">
      <thead>
        <tr>
          <th class="picks-table__sticky picks-table__sticky--rank">Rank</th>
          <th class="picks-table__sticky picks-table__sticky--entry">Entry</th>
          ${propositions
            .map(proposition => {
              const header = getPicksHeaderDetails(proposition);

              return `
                <th>
                  <div class="picks-table__game">
                    <span>${escapeHtml(proposition.roundAbbrev)}</span>
                    <strong>${escapeHtml(header.title)}</strong>
                    <span>${escapeHtml(header.meta)}</span>
                  </div>
                </th>
              `;
            })
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${currentStandings
          .map(entry => {
            return `
              <tr>
                <td class="picks-table__sticky picks-table__sticky--rank standings-table__rank">${escapeHtml(entry.rank)}</td>
                <td class="picks-table__sticky picks-table__sticky--entry">
                  <div class="picks-table__entry">
                    <span class="picks-table__entry-name">${escapeHtml(entry.name)}</span>
                    <span class="picks-table__entry-subtitle">${escapeHtml(entry.memberName)}</span>
                  </div>
                </td>
                ${propositions
                  .map(proposition => {
                    const pickState = getPickState(model, entry, proposition);

                    return `
                      <td>
                        <span class="pick-chip ${pickState.cssClass}" title="${escapeHtml(pickState.title)}">
                          ${escapeHtml(pickState.label)}
                        </span>
                      </td>
                    `;
                  })
                  .join("")}
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderDetails(model) {
  const roundPoints = [...model.pointValueByPeriod.entries()]
    .map(([period, value]) => `R${period}: ${value}`)
    .join(" • ");
  const importedOddsNote = model.oddsProjection?.standings?.length
    ? `Imported ${model.oddsProjection.source} odds are weighting each remaining pick by expected points.`
    : "You can optionally import EvanMiya tournament odds to add projected finish scores.";

  dom.detailsPanel.innerHTML = `
    <div class="details-grid">
      <div class="details-grid__row">
        <span class="details-grid__label">Group</span>
        <span class="details-grid__value">${escapeHtml(model.group.name)}</span>
      </div>
      <div class="details-grid__row">
        <span class="details-grid__label">Season</span>
        <span class="details-grid__value">${escapeHtml(model.challenge.season)}</span>
      </div>
      <div class="details-grid__row">
        <span class="details-grid__label">Group size</span>
        <span class="details-grid__value">${escapeHtml(formatCompactNumber(model.group.size))}</span>
      </div>
      ${
        model.group.limited
          ? `
            <div class="details-grid__row">
              <span class="details-grid__label">Entries shown</span>
              <span class="details-grid__value">${escapeHtml(formatCompactNumber(model.group.loadedEntries))}</span>
            </div>
          `
          : ""
      }
      <div class="details-grid__row">
        <span class="details-grid__label">Scoring</span>
        <span class="details-grid__value">ESPN bracket points</span>
      </div>
      <div class="details-grid__row">
        <span class="details-grid__label">Round values</span>
        <span class="details-grid__value">${escapeHtml(roundPoints)}</span>
      </div>
    </div>
    <ul class="details-list">
      <li>Accuracy is based on decided games at the selected moment.</li>
      <li>The timeline rewinds the standings game by game through the tournament.</li>
      <li>${escapeHtml(model.group.limited ? getLargeGroupNote(model) : `All ${model.group.loadedEntries} loaded entries are included in this view.`)}</li>
      <li>When available, the win outlook uses ESPN's current win odds.</li>
      <li>${escapeHtml(importedOddsNote)}</li>
    </ul>
  `;
}

function renderEmptyState() {
  finishChartScrub();
  renderHeroGroupSpotlight(null);
  dom.chartSnapshotStrip.className = "snapshot-strip snapshot-strip--empty";
  dom.chartSnapshotStrip.textContent = "Load a group to keep the current snapshot next to the chart.";
  dom.chartPanel.className = "chart-panel chart-panel--empty";
  dom.chartPanel.textContent = "Load a group to render the top-10 chart.";
  dom.chartScrubber.style.setProperty("--plot-left", "4.3%");
  dom.chartScrubber.style.setProperty("--plot-right", "21.5%");
  dom.leaderLegend.innerHTML = "";
  dom.outlookPanel.className = "outlook-panel outlook-panel--empty";
  dom.outlookPanel.textContent = "Late-round outlook will appear here after a group loads.";
  dom.picksPanel.className = "table-wrap table-wrap--empty";
  dom.picksPanel.textContent = "The picks matrix will appear here.";
  dom.picksSummary.textContent = "Load a group to inspect bracket picks and export them as CSV.";
  dom.standingsPanel.className = "table-wrap table-wrap--empty";
  dom.standingsPanel.textContent = "The standings table will appear here.";
  dom.timelineGame.className = "timeline-game timeline-game--empty";
  dom.timelineGame.textContent = "Load a group to inspect the schedule and the pregame leaders.";
  dom.timelineCaption.textContent = "No historical snapshots yet.";
  dom.detailsPanel.innerHTML = `
    <p class="details-panel__empty">
      Load a group to see scoring, entry counts, and how the timeline is being read.
    </p>
  `;
  dom.summarySnapshot.textContent = "No group loaded";
  dom.summaryLeader.textContent = "-";
  dom.summaryDecided.textContent = "0";
  dom.summaryMargin.textContent = "-";
  dom.summaryCutline.textContent = "-";
  dom.summaryChanges.textContent = "-";
  dom.summaryMover.textContent = "-";
  syncTimelineScrubber(null, 0);
  state.picksRoundIds = [];
  if (dom.picksRoundFilter) {
    dom.picksRoundFilter.open = false;
  }
  if (dom.picksRoundSummary) {
    dom.picksRoundSummary.textContent = "All rounds";
    dom.picksRoundSummary.setAttribute("aria-disabled", "true");
  }
  if (dom.picksRoundOptions) {
    dom.picksRoundOptions.innerHTML = '<p class="round-filter__empty">Load a group to choose rounds.</p>';
  }
  dom.downloadCsvButton.disabled = true;
  syncImportedOddsUi();
  syncOutlookModeButtons();
}

function render() {
  if (!state.model) {
    renderEmptyState();
    syncMetricButtons();
    syncChartModeButtons();
    return;
  }

  renderHeroGroupSpotlight(state.model);
  const safeIndex = Math.min(state.selectedIndex, state.model.completedProps.length);
  const standings = getSnapshotStandings(state.model, safeIndex, state.metric);
  const summary = buildSnapshotSummary(state.model, standings, safeIndex);

  renderSummary(summary);
  renderChartSnapshotStrip(summary);
  renderTimeline(state.model, standings, safeIndex);
  renderChart(state.model, safeIndex);
  renderStandings(state.model, standings);
  renderOutlook(state.model);
  renderPicksTable(state.model);
  renderDetails(state.model);
  syncMetricButtons();
  syncChartModeButtons();
  syncImportedOddsUi();
  syncOutlookModeButtons();
}

function syncMetricButtons() {
  dom.metricButtons.forEach(button => {
    const active = button.dataset.metric === state.metric;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncChartModeButtons() {
  dom.chartModeButtons.forEach(button => {
    const active = button.dataset.chartMode === state.chartMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function loadGroup(rawInput, rawSeason) {
  const lookup = parseGroupLookup(rawInput, rawSeason);

  closeMobileExportSheet();
  finishChartScrub();
  state.loading = true;
  state.rawInput = lookup.groupId;
  state.season = lookup.season;
  state.picksRoundIds = [];
  setStatus("Loading group data…", "loading");

  try {
    const challenge = await fetchChallenge(lookup.season);
    const [group, propositionsResult] = await Promise.all([
      fetchAllGroupEntries(challenge.id, lookup.groupId),
      fetchPropositions(challenge.id).catch(error => {
        console.warn("Failed to fetch full proposition catalog.", error);
        return [];
      })
    ]);
    const forecast = await fetchForecast(challenge.id, lookup.groupId, group.entries.length);
    const hydratedChallenge = {
      ...challenge,
      propositions: propositionsResult.length ? propositionsResult : challenge.propositions
    };

    state.model = buildModel(hydratedChallenge, group, forecast);
    applyImportedOddsToModel(state.model);
    state.selectedIndex = state.model.completedProps.length;
    updateUrl(lookup.groupId, lookup.season);
    rememberRecentGroup(state.model);
    setStatus(
      state.model.group.limited
        ? `Loaded ${state.model.group.name} from the ${state.model.challenge.season} tournament. ${getLargeGroupNote(state.model)}`
        : `Loaded ${state.model.group.name} with ${state.model.group.size} entries from the ${state.model.challenge.season} tournament.`,
      "success"
    );
  } catch (error) {
    state.model = null;
    setStatus(error.message, "error");
  } finally {
    state.loading = false;
    render();
  }
}

function csvEscape(value) {
  const normalized = String(value ?? "");

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

function sanitizeFileName(value) {
  return String(value ?? "group")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "group";
}

function getExportPropositions(model) {
  return model?.pickPropositions || [];
}

function getExportGameLabel(proposition) {
  if (proposition.teams.length === 2) {
    const [awayTeam, homeTeam] = proposition.teams;
    const awayLabel = awayTeam?.abbrev || awayTeam?.name || "Team 1";
    const homeLabel = homeTeam?.abbrev || homeTeam?.name || "Team 2";

    return `${proposition.roundAbbrev} ${awayLabel} @ ${homeLabel}`;
  }

  return `${proposition.roundAbbrev} ${proposition.name}`;
}

function buildPicksCsv(model) {
  const propositions = getExportPropositions(model);
  const currentStandings = getSnapshotStandings(model, model.completedProps.length, METRIC_POINTS);
  const headers = [
    "current_rank",
    "entry_name",
    "member_name",
    "current_points",
    "current_accuracy_pct",
    ...propositions.flatMap(proposition => {
      const label = getExportGameLabel(proposition);
      return [`${label} pick`, `${label} result`];
    })
  ];

  const rows = currentStandings.map(entry => {
    return [
      entry.rank,
      entry.name,
      entry.memberName,
      entry.currentPoints,
      entry.currentAccuracyPct.toFixed(1),
      ...propositions.flatMap(proposition => {
        const pickState = getPickState(model, entry, proposition);
        return [pickState.csvLabel, pickState.csvStatus];
      })
    ];
  });

  return [headers, ...rows]
    .map(row => row.map(csvEscape).join(","))
    .join("\n");
}

function revokeExportSheetUrl() {
  if (!state.exportSheetUrl) {
    return;
  }

  URL.revokeObjectURL(state.exportSheetUrl);
  state.exportSheetUrl = null;
}

function openMobileExportSheet(title) {
  if (!dom.exportSheet) {
    return;
  }

  revokeExportSheetUrl();
  dom.exportSheetTitle.textContent = title || "Preparing export";
  dom.exportSheetNote.textContent = "Getting your file ready for this device.";
  dom.exportSheetPreview.innerHTML = '<div class="export-sheet__loading">Preparing your export...</div>';
  dom.exportSheetActions.innerHTML = "";
  dom.exportSheet.hidden = false;
  window.requestAnimationFrame(() => {
    dom.exportSheetClose?.focus();
  });
}

function closeMobileExportSheet() {
  if (!dom.exportSheet) {
    return;
  }

  revokeExportSheetUrl();
  dom.exportSheet.hidden = true;
  dom.exportSheetTitle.textContent = "Preparing export";
  dom.exportSheetNote.textContent = "Getting your file ready for this device.";
  dom.exportSheetPreview.innerHTML = "";
  dom.exportSheetActions.innerHTML = "";
}

function shouldPrepareMobileExportSheet() {
  if (!dom.exportSheet || !window.matchMedia("(pointer: coarse)").matches) {
    return false;
  }

  if (!navigator.share) {
    return true;
  }

  if (typeof File !== "function" || !navigator.canShare) {
    return true;
  }

  try {
    return !navigator.canShare({
      files: [new File(["relay"], "relay-check.txt", { type: "text/plain" })]
    });
  } catch (error) {
    return true;
  }
}

async function populateMobileExportSheet(blob, fileName, title) {
  if (!dom.exportSheet) {
    return;
  }

  revokeExportSheetUrl();
  const objectUrl = URL.createObjectURL(blob);
  state.exportSheetUrl = objectUrl;
  const fullText = await blob.text();
  const previewText = escapeHtml(fullText.slice(0, 2400));
  const clipped = fullText.length > 2400;

  dom.exportSheetTitle.textContent = title;
  dom.exportSheetNote.textContent =
    "Tap save to try a direct download. If your browser opens the file instead, use copy or open it and share from there.";
  dom.exportSheetPreview.innerHTML = `<pre class="export-sheet__code">${previewText}${clipped ? "\n\n..." : ""}</pre>`;
  dom.exportSheetActions.innerHTML = `
    <a
      class="button button--primary export-sheet__button"
      href="${objectUrl}"
      download="${escapeAttribute(fileName)}"
      target="_blank"
      rel="noopener"
    >
      Save CSV
    </a>
    <a
      class="button button--ghost export-sheet__button"
      href="${objectUrl}"
      target="_blank"
      rel="noopener"
    >
      Open CSV
    </a>
    <button class="button button--secondary export-sheet__button" id="copy-export-button" type="button">
      Copy CSV
    </button>
  `;

  dom.exportSheetActions.querySelector("#copy-export-button")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      dom.exportSheetActions.querySelector("#copy-export-button").textContent = "Copied";
    } catch (error) {
      dom.exportSheetActions.querySelector("#copy-export-button").textContent = "Copy failed";
    }
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.setAttribute("download", fileName);
  link.style.display = "none";
  document.body.append(link);
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1200);
}

async function saveBlob(blob, fileName, title) {
  const mobileSheetEligible = Boolean(dom.exportSheet && window.matchMedia("(pointer: coarse)").matches);
  const file =
    typeof File === "function"
      ? new File([blob], fileName, {
          type: blob.type || "application/octet-stream"
        })
      : null;

  if (
    navigator.share &&
    file &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    try {
      await navigator.share({
        title,
        files: [file]
      });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") {
        return "cancelled";
      }

      if (mobileSheetEligible) {
        openMobileExportSheet(title);
        await populateMobileExportSheet(blob, fileName, title);
        return "sheet";
      }
    }
  }

  if (shouldPrepareMobileExportSheet()) {
    openMobileExportSheet(title);
    await populateMobileExportSheet(blob, fileName, title);
    return "sheet";
  }

  downloadBlob(blob, fileName);
  return "downloaded";
}

async function downloadCurrentPicksCsv() {
  if (!state.model) {
    return;
  }

  const csv = buildPicksCsv(state.model);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const fileName = `${sanitizeFileName(state.model.group.name)}-all-rounds-picks.csv`;
  const result = await saveBlob(blob, fileName, `${state.model.group.name} picks CSV`);

  if (result === "shared") {
    setStatus("CSV ready to share.", "success");
  } else if (result === "sheet") {
    setStatus("CSV is ready in the mobile export sheet.", "success");
  } else if (result === "downloaded") {
    setStatus("CSV download started.", "success");
  }
}

function handleSubmit(event) {
  event.preventDefault();
  loadGroup(dom.groupInput.value, dom.seasonInput.value);
}

function handleSampleLoad() {
  dom.groupInput.value = SAMPLE_GROUP.groupId;
  dom.seasonInput.value = String(SAMPLE_GROUP.season);
  loadGroup(SAMPLE_GROUP.groupId, SAMPLE_GROUP.season);
}

function handleRecentGroupClick(event) {
  const button = event.target.closest("[data-recent-group]");

  if (!button) {
    return;
  }

  const value = button.dataset.recentGroup || "";

  if (!value) {
    return;
  }

  const recentGroup = state.recentGroups.find(group => makeRecentGroupKey(group.groupId, group.season) === value);

  if (!recentGroup) {
    return;
  }

  dom.groupInput.value = recentGroup.groupId;
  dom.seasonInput.value = String(recentGroup.season);
  loadGroup(recentGroup.groupId, recentGroup.season);
}

function handleMetricToggle(event) {
  const button = event.currentTarget;

  if (!button.dataset.metric) {
    return;
  }

  state.metric = button.dataset.metric;
  render();
}

function handleChartModeToggle(event) {
  const button = event.currentTarget;

  if (!button.dataset.chartMode) {
    return;
  }

  state.chartMode = button.dataset.chartMode;
  render();
}

function handleOutlookModeToggle(event) {
  const button = event.currentTarget;
  const nextMode = button.dataset.outlookMode;

  if (!nextMode || button.disabled) {
    return;
  }

  state.outlookMode = nextMode;
  render();
}

function getImportedOddsSeason() {
  return Number(state.model?.challenge?.season || dom.seasonInput.value || state.season || getDefaultSeason());
}

async function handleOddsFileChange(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const csvText = await file.text();
    state.importedOdds = parseImportedOddsCsv(csvText, getImportedOddsSeason());
    persistImportedOdds();

    if (state.model) {
      applyImportedOddsToModel(state.model);
    }

    state.outlookMode = OUTLOOK_MODE_PROJECTION;
    setStatus(
      `Imported ${state.importedOdds.teams.length} EvanMiya team rows for the ${state.importedOdds.season} tournament.`,
      "success"
    );
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    event.target.value = "";
    render();
  }
}

function handleImportOddsClick() {
  dom.oddsFileInput?.click();
}

function handleClearOdds() {
  state.importedOdds = null;
  persistImportedOdds();

  if (state.model) {
    applyImportedOddsToModel(state.model);
  }

  state.outlookMode = OUTLOOK_MODE_ESPN;
  setStatus("Cleared imported tournament odds.", "success");
  render();
}

function handlePicksRoundChange(event) {
  const checkbox = event.target.closest("[data-round-id]");

  if (!checkbox || !state.model) {
    return;
  }

  const checkedIds = Array.from(dom.picksRoundOptions.querySelectorAll("[data-round-id]:checked")).map(input => String(input.value));
  state.picksRoundIds = checkedIds.length ? checkedIds : state.model.rounds.map(round => String(round.id));
  renderPicksTable(state.model);
}

function handlePicksRoundFilterClick(event) {
  const actionButton = event.target.closest("[data-round-action]");

  if (!actionButton || !state.model) {
    return;
  }

  if (actionButton.dataset.roundAction === "all") {
    state.picksRoundIds = state.model.rounds.map(round => String(round.id));
    renderPicksTable(state.model);
  }
}

function setSelectedIndex(nextIndex) {
  if (!state.model) {
    return;
  }

  const max = state.model.completedProps.length;
  const safeIndex = Math.max(0, Math.min(max, Number(nextIndex) || 0));

  if (safeIndex === state.selectedIndex) {
    return;
  }

  state.selectedIndex = safeIndex;
  render();
}

function handleTimelineInput(event) {
  setSelectedIndex(event.target.value);
}

function handleTimelineMarkerClick(event) {
  const button = event.target.closest("[data-snapshot-index]");

  if (!button) {
    return;
  }

  setSelectedIndex(button.dataset.snapshotIndex);
}

function adjustTimeline(delta) {
  if (!state.model) {
    return;
  }

  setSelectedIndex(state.selectedIndex + delta);
}

function finishChartScrub(pointerId = state.chartPointerId) {
  if (pointerId === null || pointerId !== state.chartPointerId) {
    return;
  }

  try {
    if (dom.chartPanel.hasPointerCapture?.(pointerId)) {
      dom.chartPanel.releasePointerCapture(pointerId);
    }
  } catch (error) {
    // Ignore release failures; capture is only a drag enhancement.
  }

  state.chartPointerId = null;
  dom.chartPanel.classList.remove("is-scrubbing");
}

function handleChartPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (!event.target.closest(".chart-hitbox")) {
    return;
  }

  state.chartPointerId = event.pointerId;
  dom.chartPanel.classList.add("is-scrubbing");
  try {
    dom.chartPanel.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Ignore capture failures; direct pointer movement still works.
  }
  const nextIndex = getChartSnapshotIndexFromClientX(event.clientX);

  if (nextIndex !== null) {
    setSelectedIndex(nextIndex);
  }

  event.preventDefault();
}

function handleChartPointerMove(event) {
  if (event.pointerId !== state.chartPointerId) {
    return;
  }

  const nextIndex = getChartSnapshotIndexFromClientX(event.clientX);

  if (nextIndex !== null) {
    setSelectedIndex(nextIndex);
  }

  event.preventDefault();
}

function handleChartPointerUp(event) {
  finishChartScrub(event.pointerId);
}

function init() {
  const lookup = getLookupFromUrl();

  state.rawInput = lookup.group;
  state.season = lookup.season;
  dom.groupInput.value = lookup.group;
  dom.seasonInput.value = String(lookup.season || getDefaultSeason());

  dom.form.addEventListener("submit", handleSubmit);
  dom.sampleButton.addEventListener("click", handleSampleLoad);
  dom.recentGroupsList?.addEventListener("click", handleRecentGroupClick);
  dom.metricButtons.forEach(button => button.addEventListener("click", handleMetricToggle));
  dom.chartModeButtons.forEach(button => button.addEventListener("click", handleChartModeToggle));
  dom.outlookModeButtons.forEach(button => button.addEventListener("click", handleOutlookModeToggle));
  dom.importOddsButton?.addEventListener("click", handleImportOddsClick);
  dom.clearOddsButton?.addEventListener("click", handleClearOdds);
  dom.oddsFileInput?.addEventListener("change", handleOddsFileChange);
  dom.picksRoundFilter?.addEventListener("change", handlePicksRoundChange);
  dom.picksRoundFilter?.addEventListener("click", handlePicksRoundFilterClick);
  dom.downloadCsvButton.addEventListener("click", downloadCurrentPicksCsv);
  dom.timelineRange.addEventListener("input", handleTimelineInput);
  dom.timelineMarkers.addEventListener("click", handleTimelineMarkerClick);
  dom.timelinePrev.addEventListener("click", () => adjustTimeline(-1));
  dom.timelineNext.addEventListener("click", () => adjustTimeline(1));
  dom.chartPanel.addEventListener("pointerdown", handleChartPointerDown);
  dom.chartPanel.addEventListener("pointermove", handleChartPointerMove);
  dom.chartPanel.addEventListener("pointerup", handleChartPointerUp);
  dom.chartPanel.addEventListener("pointercancel", handleChartPointerUp);
  dom.chartPanel.addEventListener("lostpointercapture", handleChartPointerUp);
  dom.exportSheetClose?.addEventListener("click", closeMobileExportSheet);
  dom.exportSheet?.addEventListener("click", event => {
    if (event.target === dom.exportSheet) {
      closeMobileExportSheet();
    }
  });

  renderEmptyState();
  renderRecentGroups();
  syncMetricButtons();
  syncChartModeButtons();
  syncImportedOddsUi();
  syncOutlookModeButtons();

  if (lookup.group) {
    loadGroup(lookup.group, lookup.season);
  }
}

init();
