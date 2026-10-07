// @ts-nocheck
// Run with Node 22: node scripts/calibrate-style.ts <folder-of-exported-rounds>
const fs = require("node:fs");
const path = require("node:path");

function listJsonFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(folder, entry.name);
    return entry.isDirectory() ? listJsonFiles(fullPath) : entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

function percentile(sortedValues, fraction) {
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const share = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - share) + sortedValues[upperIndex] * share;
}

function main() {
  const folder = process.argv[2];
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.error("Usage: node scripts/calibrate-style.ts <folder-of-exported-rounds>");
    process.exitCode = 1;
    return;
  }

  const resolvedFolder = path.resolve(folder);
  const files = listJsonFiles(resolvedFolder);
  const playerIds = new Set();
  const distancesCm = [];
  let roundsUsed = 0;
  let skippedFiles = 0;

  for (const file of files) {
    try {
      const recording = JSON.parse(fs.readFileSync(file, "utf8"));
      const relativePath = path.relative(resolvedFolder, file);
      const firstFolder = relativePath.split(path.sep)[0];
      const folderPlayerId = path.dirname(relativePath) === "." ? null : firstFolder;
      const playerId = recording.playerId || folderPlayerId;
      const countsPerCm = Number(recording.dpi) / 2.54;
      if (!playerId || !Number.isFinite(countsPerCm) || countsPerCm <= 0
        || !Array.isArray(recording.mouseSamples) || !Array.isArray(recording.clickTimes)
        || !Array.isArray(recording.flickAttempts)) {
        skippedFiles += 1;
        continue;
      }

      const samples = recording.mouseSamples.filter((sample) => Number.isFinite(sample.time)
        && Number.isFinite(sample.dx) && Number.isFinite(sample.dy));
      let roundFlicks = 0;
      const pairs = Math.min(recording.clickTimes.length, recording.flickAttempts.length);
      for (let index = 0; index < pairs; index += 1) {
        const attempt = recording.flickAttempts[index];
        const clickTime = recording.clickTimes[index];
        if (!Number.isFinite(attempt.spawnTime) || !Number.isFinite(clickTime) || clickTime < attempt.spawnTime) continue;
        const counts = samples
          .filter((sample) => sample.time >= attempt.spawnTime && sample.time <= clickTime)
          .reduce((sum, sample) => sum + Math.hypot(sample.dx, sample.dy), 0);
        const distanceCm = counts / countsPerCm;
        if (Number.isFinite(distanceCm) && distanceCm > 0) {
          distancesCm.push(distanceCm);
          roundFlicks += 1;
        }
      }

      if (roundFlicks > 0) {
        roundsUsed += 1;
        playerIds.add(String(playerId));
      } else {
        skippedFiles += 1;
      }
    } catch (error) {
      skippedFiles += 1;
      console.warn(`Skipped ${file}: ${error.message}`);
    }
  }

  console.log(`Rounds used: ${roundsUsed}`);
  console.log(`Players represented: ${playerIds.size}`);
  console.log(`Flicks used: ${distancesCm.length}`);
  if (skippedFiles) console.log(`Files skipped (invalid data or no measured movement): ${skippedFiles}`);
  if (!distancesCm.length) {
    console.error("No flick distances were available to calculate cutoffs.");
    process.exitCode = 1;
    return;
  }

  distancesCm.sort((left, right) => left - right);
  const smallMaxCm = percentile(distancesCm, 1 / 3);
  const mediumMaxCm = percentile(distancesCm, 2 / 3);
  console.log(`Proposed cutoffs: small <= ${smallMaxCm.toFixed(3)} cm; medium <= ${mediumMaxCm.toFixed(3)} cm; large > ${mediumMaxCm.toFixed(3)} cm.`);

  if (playerIds.size < 5) {
    console.log("Cutoffs not written. Add rounds from at least 5 distinct players, then run this command again.");
    return;
  }

  const configPath = path.resolve(__dirname, "../web/lib/drillConfig.ts");
  const config = fs.readFileSync(configPath, "utf8");
  const cutoffPattern = /distanceCutoffsCm:\s*(?:null\s+as\s+\{[^}]+\}\s+\|\s+null|\{[^}]+\})/;
  if (!cutoffPattern.test(config)) {
    throw new Error(`Could not find distanceCutoffsCm in ${configPath}`);
  }
  const updatedConfig = config.replace(cutoffPattern,
    `distanceCutoffsCm: { smallMaxCm: ${smallMaxCm.toFixed(3)}, mediumMaxCm: ${mediumMaxCm.toFixed(3)} }`);
  fs.writeFileSync(configPath, updatedConfig);
  console.log(`Cutoffs written to ${configPath}`);
}

main();
