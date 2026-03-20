import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SOURCE_URL = "https://evanmiya.com/?tourney_odds";
const TABLE_TITLE = "March Madness Tournament Probabilities";
const TABLE_HEADERS = ["Team", "Seed", "Round 32 %", "Sweet 16 %", "Elite Eight %", "Final Four %", "Title Game %", "Champ %"];
const TIMEZONE_OFFSETS = {
  EDT: "-04:00",
  EST: "-05:00"
};

function parsePercentageValue(value) {
  const normalized = String(value ?? "").replace(/%/g, "").trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const probability = parsed > 1 ? parsed / 100 : parsed;
  return Number(probability.toFixed(4));
}

function findIndexFrom(lines, target, startIndex = 0) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index] === target) {
      return index;
    }
  }

  return -1;
}

function normalizeUpdatedAt(updateLine) {
  const match = String(updateLine || "").match(/^Updated\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z]{3})$/);

  if (!match) {
    return "";
  }

  const [, day, time, zone] = match;
  const offset = TIMEZONE_OFFSETS[zone];

  if (!offset) {
    return `${day}T${time}`;
  }

  return `${day}T${time}${offset}`;
}

function parseOddsTable(text, season) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const titleIndex = findIndexFrom(lines, TABLE_TITLE);

  if (titleIndex < 0) {
    throw new Error("Couldn't find the tournament-odds table on the EvanMiya page.");
  }

  const updateLine = lines.find(line => line.startsWith("Updated ")) || "";
  const headerIndex = findIndexFrom(lines, TABLE_HEADERS[0], titleIndex);
  const headers = lines.slice(headerIndex, headerIndex + TABLE_HEADERS.length);

  if (headerIndex < 0 || headers.join("|") !== TABLE_HEADERS.join("|")) {
    throw new Error("The EvanMiya tournament-odds headers did not match the expected format.");
  }

  const teams = [];

  for (let index = headerIndex + TABLE_HEADERS.length; index + 7 < lines.length; ) {
    const chunk = lines.slice(index, index + 8);
    const [name, seed, ...percentages] = chunk;
    const looksLikeRow =
      Boolean(name) &&
      /^\d+$/.test(seed) &&
      percentages.length === 6 &&
      percentages.every(value => /%$/.test(value));

    if (!looksLikeRow) {
      if (teams.length) {
        break;
      }

      index += 1;
      continue;
    }

    teams.push({
      name,
      seed,
      roundProbabilities: {
        1: parsePercentageValue(percentages[0]),
        2: parsePercentageValue(percentages[1]),
        3: parsePercentageValue(percentages[2]),
        4: parsePercentageValue(percentages[3]),
        5: parsePercentageValue(percentages[4]),
        6: parsePercentageValue(percentages[5])
      }
    });
    index += 8;
  }

  if (teams.length < 32) {
    throw new Error(`Expected at least 32 odds rows, found ${teams.length}.`);
  }

  return {
    importedAt: new Date().toISOString(),
    season,
    source: "EvanMiya Tourney Odds",
    teams,
    updatedAt: normalizeUpdatedAt(updateLine)
  };
}

async function fetchOddsPageText() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  try {
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(
      expectedTitle => {
        const text = document.body.innerText || "";
        return text.includes(expectedTitle) && text.includes("Round 32 %") && text.includes("Champ %");
      },
      TABLE_TITLE,
      { timeout: 120000 }
    );
    await page.waitForTimeout(4000);
    return await page.evaluate(() => document.body.innerText || "");
  } finally {
    await browser.close();
  }
}

async function main() {
  const currentYear = new Date().getFullYear();
  const season = Number(process.argv[2] || currentYear);

  if (!Number.isFinite(season)) {
    throw new Error("Pass a numeric season, for example `2026`.");
  }

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(rootDir, "data", `evanmiya-tourney-odds-${season}.json`);
  const text = await fetchOddsPageText();
  const payload = parseOddsTable(text, season);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${payload.teams.length} EvanMiya odds rows to ${outputPath}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
