const GAMBIT_BASE = "https://gambit-api.fantasy.espn.com/apis/v1";
const SAMPLE_GROUP = {
  groupId: "6e682872-7e5f-3aa2-84bf-003cb6a630ae",
  name: "SportsCenter",
  season: 2026
};
const MAX_PAGE_SIZE = 200;
const MAX_LEADER_LINES = 8;
const METRIC_POINTS = "points";
const METRIC_ACCURACY = "accuracy";
const LEADER_COLORS = [
  "#ba3a1b",
  "#204e7b",
  "#2d7b56",
  "#d3a14a",
  "#7b5a2e",
  "#b05f2b",
  "#4f6474",
  "#8f4130"
];

const state = {
  loading: false,
  metric: METRIC_POINTS,
  picksRound: "all",
  season: getDefaultSeason(),
  rawInput: "",
  selectedIndex: 0,
  model: null
};

const dom = {
  chartPanel: document.getElementById("chart-panel"),
  detailsPanel: document.getElementById("details-panel"),
  downloadCsvButton: document.getElementById("download-csv-button"),
  form: document.getElementById("group-form"),
  groupInput: document.getElementById("group-input"),
  leaderLegend: document.getElementById("leader-legend"),
  metricButtons: Array.from(document.querySelectorAll("[data-metric]")),
  outlookPanel: document.getElementById("outlook-panel"),
  picksPanel: document.getElementById("picks-panel"),
  picksRoundSelect: document.getElementById("picks-round-select"),
  picksSummary: document.getElementById("picks-summary"),
  sampleButton: document.getElementById("sample-button"),
  seasonInput: document.getElementById("season-input"),
  standingsPanel: document.getElementById("standings-panel"),
  statusBanner: document.getElementById("status-banner"),
  summaryAlive: document.getElementById("summary-alive"),
  summaryDecided: document.getElementById("summary-decided"),
  summaryLeader: document.getElementById("summary-leader"),
  summarySnapshot: document.getElementById("summary-snapshot"),
  timelineCaption: document.getElementById("timeline-caption"),
  timelineGame: document.getElementById("timeline-game"),
  timelineNext: document.getElementById("timeline-next"),
  timelinePrev: document.getElementById("timeline-prev"),
  timelineRange: document.getElementById("timeline-range")
};

function getDefaultSeason() {
  return new Date().getFullYear();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  throw new Error("Could not parse that value. Use a group UUID or a full ESPN group URL.");
}

function updateUrl(groupId, season) {
  const url = new URL(window.location.href);
  url.searchParams.set("groupId", groupId);
  url.searchParams.set("season", String(season));
  window.history.replaceState({}, "", url);
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

async function fetchChallenge(season) {
  const challengeKey = `tournament-challenge-bracket-${season}`;
  const response = await fetchJson(`/challenges/${challengeKey}`, {
    platform: "chui",
    view: "chui_default"
  });

  return response.data;
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

async function fetchAllGroupEntries(challengeId, groupId) {
  const firstPage = await fetchGroupPage(challengeId, groupId, 0, MAX_PAGE_SIZE);
  const pages = [firstPage];
  let fetched = firstPage.entries.length;

  while (fetched < firstPage.size) {
    const page = await fetchGroupPage(challengeId, groupId, fetched, MAX_PAGE_SIZE);

    if (!page.entries.length) {
      break;
    }

    pages.push(page);
    fetched += page.entries.length;
  }

  return {
    ...firstPage,
    entries: pages.flatMap(page => page.entries)
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

  const propositions = normalizePropositions(challenge);
  const completedProps = propositions.filter(proposition => proposition.status === "COMPLETE");
  const currentLeaderScore = groupResponse.entries.reduce(
    (maxScore, entry) => Math.max(maxScore, entry.score?.overallScore || 0),
    0
  );
  const forecastMap = normalizeForecastMap(forecastResponse.available ? forecastResponse.entries : []);
  const entries = buildEntryModels(groupResponse.entries, completedProps, pointValueByPeriod, forecastMap, currentLeaderScore);
  const rounds = propositions.reduce((result, proposition) => {
    if (!result.some(round => round.id === proposition.scoringPeriodId)) {
      result.push({
        abbrev: proposition.roundAbbrev,
        id: proposition.scoringPeriodId,
        label: proposition.roundLabel
      });
    }

    return result;
  }, []);

  return {
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
      id: groupResponse.groupId,
      isLarge: Boolean(groupResponse.largeGroup),
      isLocked: Boolean(groupResponse.locked),
      name: groupResponse.groupSettings?.name || groupResponse.groupId,
      public: Boolean(groupResponse.groupSettings?.public),
      size: groupResponse.size || groupResponse.entries.length
    },
    pointValueByPeriod,
    propositions,
    rounds
  };
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

function getLeaderIdsBySnapshot(model, metric) {
  const counts = new Map();
  const totalSnapshots = model.completedProps.length + 1;

  for (let index = 0; index < totalSnapshots; index += 1) {
    const standings = getSnapshotStandings(model, index, metric);

    if (!standings.length) {
      continue;
    }

    const leadValue = metricValue(standings[0], metric);

    standings
      .filter(entry => valuesMatch(metricValue(entry, metric), leadValue, metric))
      .forEach(entry => {
        counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
      });
  }

  let leaderIds = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_LEADER_LINES)
    .map(([id]) => id);

  if (!leaderIds.length) {
    leaderIds = model.entries.slice(0, Math.min(model.entries.length, MAX_LEADER_LINES)).map(entry => entry.id);
  }

  return leaderIds;
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

function formatMetricDisplay(value, metric) {
  return metric === METRIC_ACCURACY ? `${value.toFixed(1)}%` : `${value} pts`;
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

  return laidOut;
}

function getPicksPropositions(model) {
  if (!model) {
    return [];
  }

  if (state.picksRound === "all") {
    return model.propositions;
  }

  const filtered = model.propositions.filter(proposition => String(proposition.scoringPeriodId) === state.picksRound);

  if (filtered.length) {
    return filtered;
  }

  state.picksRound = "all";
  return model.propositions;
}

function getPickState(entry, proposition) {
  const pick = entry.picksByPropositionId.get(proposition.id);
  const pickedOutcome = pick?.outcomesPicked?.[0];

  if (!pickedOutcome) {
    return {
      cssClass: "pick-chip--missing",
      csvValue: "",
      label: "—",
      status: "NO PICK",
      title: "No pick recorded"
    };
  }

  const team = proposition.teams.find(candidate => candidate.id === pickedOutcome.outcomeId);
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
    csvValue: `${team?.name || label} (${status})`,
    label,
    status,
    title: `${team?.name || label} • ${status}`
  };
}

function syncPicksControls(model) {
  if (!model) {
    dom.picksRoundSelect.innerHTML = '<option value="all">All rounds</option>';
    dom.picksRoundSelect.disabled = true;
    dom.downloadCsvButton.disabled = true;
    return;
  }

  const validRound = state.picksRound === "all" || model.rounds.some(round => String(round.id) === state.picksRound);

  if (!validRound) {
    state.picksRound = "all";
  }

  dom.picksRoundSelect.innerHTML = `
    <option value="all">All rounds</option>
    ${model.rounds
      .map(
        round => `
          <option value="${escapeHtml(round.id)}"${state.picksRound === String(round.id) ? " selected" : ""}>
            ${escapeHtml(round.label)}
          </option>
        `
      )
      .join("")}
  `;
  dom.picksRoundSelect.disabled = false;
  dom.downloadCsvButton.disabled = false;
}

function renderSummary(model, standings, snapshotIndex) {
  const leaders = getLeaderSummary(standings, state.metric);
  const leaderNames = leaders.entries.slice(0, 2).map(entry => entry.name);
  const extraLeaders = Math.max(leaders.entries.length - leaderNames.length, 0);
  const currentAliveCount = model.entries.filter(entry => entry.stillAlive).length;
  const leaderText = leaderNames.length
    ? `${leaderNames.join(", ")}${extraLeaders ? ` +${extraLeaders}` : ""}`
    : "-";

  dom.summarySnapshot.textContent = getSnapshotLabel(model, snapshotIndex);
  dom.summaryLeader.innerHTML = `
    ${escapeHtml(leaderText)}
    <div class="metric-card__detail">${escapeHtml(leaders.valueText)}</div>
  `;
  dom.summaryDecided.textContent = `${snapshotIndex} of ${model.completedProps.length}`;
  dom.summaryAlive.textContent = `${currentAliveCount} / ${model.group.size}`;
}

function renderTimeline(model, standings, snapshotIndex) {
  const completedCount = model.completedProps.length;

  dom.timelineRange.max = String(completedCount);
  dom.timelineRange.value = String(snapshotIndex);
  dom.timelineRange.disabled = completedCount === 0;
  dom.timelinePrev.disabled = snapshotIndex <= 0;
  dom.timelineNext.disabled = snapshotIndex >= completedCount;
  dom.timelineCaption.textContent = `${getSnapshotLabel(model, snapshotIndex)} • ${snapshotIndex} completed games were already in the book`;

  if (!completedCount) {
    dom.timelineGame.className = "timeline-game timeline-game--empty";
    dom.timelineGame.textContent = "The tournament has not logged any completed games yet for this group.";
    return;
  }

  if (snapshotIndex >= completedCount) {
    const leaders = getLeaderSummary(standings, state.metric);
    const lastGame = model.completedProps[completedCount - 1];

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
      <p class="timeline-game__copy">
        ${escapeHtml(leaders.entries.map(entry => entry.name).join(", "))} lead${leaders.entries.length > 1 ? "" : "s"} the group right now.
      </p>
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
    <p class="timeline-game__copy">
      Before tip, ${escapeHtml(leaders.entries.map(entry => entry.name).join(", "))} led the group by ${escapeHtml(
        leaders.valueText
      )}.
    </p>
    ${
      proposition.gameUrl
        ? `<a class="timeline-game__link" href="${escapeHtml(proposition.gameUrl)}" target="_blank" rel="noreferrer">Open matchup on ESPN</a>`
        : ""
    }
  `;
}

function renderChart(model, selectedIndex) {
  const leaderIds = getLeaderIdsBySnapshot(model, state.metric);
  const totalSnapshots = model.completedProps.length + 1;

  if (!leaderIds.length || totalSnapshots <= 1) {
    dom.chartPanel.className = "chart-panel chart-panel--empty";
    dom.chartPanel.textContent = "Load a group with completed games to render the leader graph.";
    dom.leaderLegend.innerHTML = "";
    return;
  }

  const leaderEntries = leaderIds
    .map(id => model.entries.find(entry => entry.id === id))
    .filter(Boolean)
    .map((entry, index) => ({
      color: LEADER_COLORS[index % LEADER_COLORS.length],
      entry
    }));
  const legendStandings = getSnapshotStandings(model, selectedIndex, state.metric);
  const legendDetailsById = new Map(
    legendStandings.map(entry => [entry.id, { rank: entry.rank, valueText: formatMetricDisplay(metricValue(entry, state.metric), state.metric) }])
  );

  const width = 980;
  const height = 360;
  const padding = { top: 20, right: 210, bottom: 32, left: 42 };
  const plotRight = width - padding.right;
  const chartWidth = plotRight - padding.left;
  const chartHeight = height - padding.top - padding.bottom;
  const values = [];

  leaderEntries.forEach(({ entry }) => {
    entry.series.forEach(snapshot => {
      values.push(state.metric === METRIC_ACCURACY ? snapshot.accuracyPct : snapshot.points);
    });
  });

  const maxValue = state.metric === METRIC_ACCURACY ? 100 : Math.max(...values, 1);
  const minValue = 0;
  const xStep = totalSnapshots > 1 ? chartWidth / (totalSnapshots - 1) : chartWidth;
  const yFor = value => {
    const ratio = (value - minValue) / Math.max(maxValue - minValue, 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };
  const xFor = index => padding.left + index * xStep;

  const gridValues = state.metric === METRIC_ACCURACY ? [0, 25, 50, 75, 100] : buildPointTicks(maxValue);
  const selectionX = xFor(selectedIndex);
  const labeledLeaderCount = Math.min(leaderEntries.length, 5);
  const callouts = layoutChartCallouts(
    leaderEntries.slice(0, labeledLeaderCount).map(({ entry, color }) => {
      const currentSnapshot = entry.series[selectedIndex];
      const currentValue = state.metric === METRIC_ACCURACY ? currentSnapshot.accuracyPct : currentSnapshot.points;
      const currentX = xFor(selectedIndex);
      const currentY = yFor(currentValue);
      const shortLabel = truncateLabel(entry.name, 20);
      const valueText = formatMetricDisplay(currentValue, state.metric);

      return {
        color,
        currentX,
        currentY,
        entryId: entry.id,
        label: shortLabel,
        labelWidth: Math.max(122, Math.min(184, Math.max(shortLabel.length * 7.3, valueText.length * 7) + 28)),
        targetY: currentY,
        valueText
      };
    }),
    padding.top + 18,
    height - padding.bottom - 18,
    42
  );
  const calloutMarkup = callouts
    .map(callout => {
      const labelX = plotRight + 18;
      const labelY = callout.y;
      const labelHeight = 38;
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

  dom.chartPanel.className = "chart-panel";
  dom.chartPanel.innerHTML = `
    <div class="chart-shell">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Leader history chart">
        ${gridValues
          .map(value => {
            const y = yFor(value);

            return `
              <line class="chart-grid-line" x1="${padding.left}" x2="${plotRight}" y1="${y}" y2="${y}" />
              <text class="chart-axis-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(
                state.metric === METRIC_ACCURACY ? `${value}%` : String(value)
              )}</text>
            `;
          })
          .join("")}
        <line class="chart-selection-line" x1="${selectionX}" x2="${selectionX}" y1="${padding.top}" y2="${height - padding.bottom}" />
        ${leaderEntries
          .map(({ entry, color }, index) => {
            const path = entry.series
              .map((snapshot, snapshotIndex) => {
                const x = xFor(snapshotIndex);
                const y = yFor(state.metric === METRIC_ACCURACY ? snapshot.accuracyPct : snapshot.points);

                return `${snapshotIndex === 0 ? "M" : "L"}${x},${y}`;
              })
              .join(" ");
            const currentSnapshot = entry.series[selectedIndex];
            const currentValue = state.metric === METRIC_ACCURACY ? currentSnapshot.accuracyPct : currentSnapshot.points;
            const currentX = xFor(selectedIndex);
            const currentY = yFor(currentValue);

            return `
              <path class="chart-path ${index >= labeledLeaderCount ? "chart-path--muted" : ""}" d="${path}" stroke="${color}" />
              <circle class="chart-point" cx="${currentX}" cy="${currentY}" r="5" fill="${color}" />
            `;
          })
          .join("")}
        ${calloutMarkup}
      </svg>
    </div>
  `;

  dom.leaderLegend.innerHTML = leaderEntries
    .map(({ entry, color }) => {
      const details = legendDetailsById.get(entry.id);

      return `
        <div class="legend__item">
          <span class="legend__dot" style="background:${color}"></span>
          <span class="legend__copy">
            <span class="legend__name">${escapeHtml(entry.name)}</span>
            <span class="legend__meta">${escapeHtml(details ? `#${details.rank} • ${details.valueText}` : "")}</span>
          </span>
        </div>
      `
    })
    .join("");
}

function buildPointTicks(maxValue) {
  const tickCount = 5;
  const step = Math.max(10, Math.ceil(maxValue / tickCount / 10) * 10);
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

function renderOutlook(model) {
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
  const forecastCopy = forecastAvailable
    ? "ESPN’s forecast feed is live, so the list below uses its win probabilities."
    : model.forecast.message ||
      "ESPN has not unlocked the permutation forecast yet, so this view uses current score and possible max to mark who is still alive.";

  dom.outlookPanel.className = "outlook-panel";
  dom.outlookPanel.innerHTML = `
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
              <div class="stack-list__title-row">
                <span class="stack-list__title">No live paths remain</span>
                <span class="stack-list__value">Finished</span>
              </div>
              <p class="stack-list__meta">
                ESPN possible-max scoring has every other entry eliminated from first place.
              </p>
            </div>
          `
      }
    </div>
  `;
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
  const roundLabel =
    state.picksRound === "all"
      ? `all ${model.rounds.length} rounds`
      : model.rounds.find(round => String(round.id) === state.picksRound)?.label || "selected round";

  dom.picksSummary.textContent = `Showing ${propositions.length} games from ${roundLabel}. CSV export uses this same filter.`;

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
              const teamsLabel = proposition.teams.map(team => team.abbrev || team.name).join(" / ");

              return `
                <th>
                  <div class="picks-table__game">
                    <span>${escapeHtml(proposition.roundAbbrev)}</span>
                    <strong>${escapeHtml(teamsLabel)}</strong>
                    <span>${escapeHtml(formatShortDate(proposition.date))}</span>
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
                    const pickState = getPickState(entry, proposition);

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
        <span class="details-grid__label">Members</span>
        <span class="details-grid__value">${escapeHtml(formatCompactNumber(model.group.size))}</span>
      </div>
      <div class="details-grid__row">
        <span class="details-grid__label">Format</span>
        <span class="details-grid__value">ESPN bracket points</span>
      </div>
      <div class="details-grid__row">
        <span class="details-grid__label">Round values</span>
        <span class="details-grid__value">${escapeHtml(roundPoints)}</span>
      </div>
    </div>
    <ul class="details-list">
      <li>Accuracy is computed as correct picks divided by decided picks at the selected moment.</li>
      <li>The time machine reconstructs snapshots from public group picks plus completed ESPN challenge propositions.</li>
      <li>The win outlook switches to ESPN forecast percentages automatically if that feed becomes available late in the tournament.</li>
    </ul>
  `;
}

function renderEmptyState() {
  dom.chartPanel.className = "chart-panel chart-panel--empty";
  dom.chartPanel.textContent = "Load a group to render the leader chart.";
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
      Public ESPN challenge data, group picks, and optional forecast data are combined here. Historical snapshots are ordered by completed game tip times.
    </p>
  `;
  dom.summarySnapshot.textContent = "No group loaded";
  dom.summaryLeader.textContent = "-";
  dom.summaryDecided.textContent = "0";
  dom.summaryAlive.textContent = "-";
  dom.timelineRange.value = "0";
  dom.timelineRange.max = "0";
  dom.timelineRange.disabled = true;
  dom.timelinePrev.disabled = true;
  dom.timelineNext.disabled = true;
  dom.picksRoundSelect.innerHTML = '<option value="all">All rounds</option>';
  dom.picksRoundSelect.disabled = true;
  dom.downloadCsvButton.disabled = true;
}

function render() {
  if (!state.model) {
    renderEmptyState();
    syncMetricButtons();
    return;
  }

  const safeIndex = Math.min(state.selectedIndex, state.model.completedProps.length);
  const standings = getSnapshotStandings(state.model, safeIndex, state.metric);

  renderSummary(state.model, standings, safeIndex);
  renderTimeline(state.model, standings, safeIndex);
  renderChart(state.model, safeIndex);
  renderStandings(state.model, standings);
  renderOutlook(state.model);
  renderPicksTable(state.model);
  renderDetails(state.model);
  syncMetricButtons();
}

function syncMetricButtons() {
  dom.metricButtons.forEach(button => {
    const active = button.dataset.metric === state.metric;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function loadGroup(rawInput, rawSeason) {
  const lookup = parseGroupLookup(rawInput, rawSeason);

  state.loading = true;
  state.rawInput = lookup.groupId;
  state.season = lookup.season;
  state.picksRound = "all";
  setStatus("Loading ESPN challenge and group data…", "loading");

  try {
    const challenge = await fetchChallenge(lookup.season);
    const group = await fetchAllGroupEntries(challenge.id, lookup.groupId);
    const forecast = await fetchForecast(challenge.id, lookup.groupId, group.size || group.entries.length);

    state.model = buildModel(challenge, group, forecast);
    state.selectedIndex = state.model.completedProps.length;
    updateUrl(lookup.groupId, lookup.season);
    setStatus(
      `Loaded ${state.model.group.name} with ${state.model.group.size} entries from the ${state.model.challenge.season} tournament.`,
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

function buildPicksCsv(model) {
  const propositions = getPicksPropositions(model);
  const currentStandings = getSnapshotStandings(model, model.completedProps.length, METRIC_POINTS);
  const headers = [
    "current_rank",
    "entry_name",
    "member_name",
    "current_points",
    "current_accuracy_pct",
    ...propositions.map(proposition => `${proposition.roundAbbrev} ${proposition.name}`)
  ];

  const rows = currentStandings.map(entry => {
    return [
      entry.rank,
      entry.name,
      entry.memberName,
      entry.currentPoints,
      entry.currentAccuracyPct.toFixed(1),
      ...propositions.map(proposition => getPickState(entry, proposition).csvValue)
    ];
  });

  return [headers, ...rows]
    .map(row => row.map(csvEscape).join(","))
    .join("\n");
}

function downloadCurrentPicksCsv() {
  if (!state.model) {
    return;
  }

  const csv = buildPicksCsv(state.model);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const roundSegment = state.picksRound === "all" ? "all-rounds" : `round-${state.picksRound}`;

  anchor.href = url;
  anchor.download = `${sanitizeFileName(state.model.group.name)}-${roundSegment}-picks.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

function handleMetricToggle(event) {
  const button = event.currentTarget;

  if (!button.dataset.metric) {
    return;
  }

  state.metric = button.dataset.metric;
  render();
}

function handlePicksRoundChange(event) {
  state.picksRound = event.target.value || "all";
  renderPicksTable(state.model);
}

function handleTimelineInput(event) {
  state.selectedIndex = Number(event.target.value);
  render();
}

function adjustTimeline(delta) {
  if (!state.model) {
    return;
  }

  const max = state.model.completedProps.length;
  state.selectedIndex = Math.max(0, Math.min(max, state.selectedIndex + delta));
  render();
}

function init() {
  const lookup = getLookupFromUrl();

  state.rawInput = lookup.group;
  state.season = lookup.season;
  dom.groupInput.value = lookup.group;
  dom.seasonInput.value = String(lookup.season || getDefaultSeason());

  dom.form.addEventListener("submit", handleSubmit);
  dom.sampleButton.addEventListener("click", handleSampleLoad);
  dom.metricButtons.forEach(button => button.addEventListener("click", handleMetricToggle));
  dom.picksRoundSelect.addEventListener("change", handlePicksRoundChange);
  dom.downloadCsvButton.addEventListener("click", downloadCurrentPicksCsv);
  dom.timelineRange.addEventListener("input", handleTimelineInput);
  dom.timelinePrev.addEventListener("click", () => adjustTimeline(-1));
  dom.timelineNext.addEventListener("click", () => adjustTimeline(1));

  renderEmptyState();
  syncMetricButtons();

  if (lookup.group) {
    loadGroup(lookup.group, lookup.season);
  }
}

init();
