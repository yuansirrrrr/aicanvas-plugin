import { normalizeText, toFiniteNumber, truncateText } from "./canvasNodeSnapshot.js";

const BEAT_RANKS = new Map([
  ["opening", 0],
  ["setup", 0],
  ["hook", 0],
  ["discovery", 1],
  ["conflict", 2],
  ["core", 2],
  ["action", 2],
  ["atmosphere", 3],
  ["vibe", 3],
  ["climax", 4],
  ["ending", 5],
  ["end", 5],
]);

function uniqueClips(clips = []) {
  const out = [];
  const seen = new Set();
  const duplicateIds = [];
  for (const clip of Array.isArray(clips) ? clips : []) {
    const id = normalizeText(clip?.id || clip?.videoNodeId);
    if (!id) continue;
    if (seen.has(id)) {
      duplicateIds.push(id);
      continue;
    }
    out.push({ ...clip, id, inputIndex: out.length });
    seen.add(id);
  }
  return { clips: out, duplicateIds };
}

function storySignalsOf(clip = {}) {
  const signals = Array.isArray(clip.storySignals) ? clip.storySignals : [];
  return signals.map((signal) => normalizeText(signal).toLowerCase()).filter(Boolean);
}

function beatRank(clip = {}) {
  const candidates = [
    normalizeText(clip.storyBeat).toLowerCase(),
    ...storySignalsOf(clip),
  ];
  for (const candidate of candidates) {
    if (BEAT_RANKS.has(candidate)) return BEAT_RANKS.get(candidate);
    for (const [key, rank] of BEAT_RANKS.entries()) {
      if (candidate.includes(key)) return rank;
    }
  }
  return 2;
}

function storyBeatLabel(clip = {}) {
  const signal = normalizeText(clip.storyBeat) || normalizeText(clip.storySignals?.[0]);
  if (signal) return signal;
  const rank = beatRank(clip);
  if (rank === 0) return "opening";
  if (rank === 1) return "discovery";
  if (rank === 3) return "atmosphere";
  if (rank === 4) return "climax";
  if (rank === 5) return "ending";
  return "core";
}

function sceneKey(clip = {}) {
  return normalizeText(clip.scene).toLowerCase();
}

function hasShotIndex(clip = {}) {
  const number = Number(clip.knownShotIndex ?? clip.shotIndex ?? clip.shotNumber);
  return Number.isFinite(number) && number > 0;
}

function shotIndex(clip = {}) {
  const number = Number(clip.knownShotIndex ?? clip.shotIndex ?? clip.shotNumber);
  return Number.isFinite(number) && number > 0 ? number : Number.POSITIVE_INFINITY;
}

function durationOf(clip = {}) {
  const duration = Number(clip.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function positionOf(clip = {}) {
  return {
    x: toFiniteNumber(clip.canvasPosition?.x ?? clip.x, 0),
    y: toFiniteNumber(clip.canvasPosition?.y ?? clip.y, 0),
  };
}

function detectIntent(userIntent = "") {
  const text = normalizeText(userIntent).toLowerCase();
  if (/reverse|backward|\u5012\u53d9|\u5012\u5e8f/.test(text)) return "reverse";
  if (/climax first|start with climax|\u5148.*\u9ad8\u6f6e|\u9ad8\u6f6e.*\u5f00\u5934|\u5148.*\u53cd\u8f6c/.test(text)) {
    return "climaxFirst";
  }
  return "default";
}

function compareCanvasPosition(a, b) {
  const posA = positionOf(a);
  const posB = positionOf(b);
  if (posA.x !== posB.x) return posA.x - posB.x;
  if (posA.y !== posB.y) return posA.y - posB.y;
  return a.inputIndex - b.inputIndex;
}

function sortDefault(clips) {
  const indexedCount = clips.filter(hasShotIndex).length;
  const majorityIndexed = indexedCount >= Math.ceil(clips.length / 2);
  return clips.slice().sort((a, b) => {
    if (majorityIndexed && shotIndex(a) !== shotIndex(b)) return shotIndex(a) - shotIndex(b);
    const beatDelta = beatRank(a) - beatRank(b);
    if (beatDelta !== 0 && !majorityIndexed) return beatDelta;
    const sceneA = sceneKey(a);
    const sceneB = sceneKey(b);
    if (sceneA && sceneB && sceneA !== sceneB && !majorityIndexed) return sceneA.localeCompare(sceneB);
    if (!majorityIndexed && shotIndex(a) !== shotIndex(b)) return shotIndex(a) - shotIndex(b);
    return compareCanvasPosition(a, b);
  });
}

function sortForIntent(clips, intent) {
  if (intent === "reverse") {
    const sorted = sortDefault(clips);
    return sorted.reverse();
  }
  if (intent === "climaxFirst") {
    return sortDefault(clips).sort((a, b) => {
      const aClimax = beatRank(a) === 4 ? 0 : 1;
      const bClimax = beatRank(b) === 4 ? 0 : 1;
      if (aClimax !== bClimax) return aClimax - bClimax;
      return sortDefault([a, b])[0]?.id === a.id ? -1 : 1;
    });
  }
  return sortDefault(clips);
}

function shouldStartNewGroup(currentGroup, clip) {
  if (!currentGroup.length) return false;
  if (durationOf(clip) >= 10 && currentGroup.length > 0) return true;
  if (currentGroup.length >= 4) return true;
  const currentDuration = currentGroup.reduce((sum, item) => sum + durationOf(item), 0);
  if (currentDuration + durationOf(clip) > 20 && currentGroup.length >= 2) return true;
  const last = currentGroup[currentGroup.length - 1];
  const sameScene = sceneKey(last) && sceneKey(last) === sceneKey(clip);
  const sameBeat = storyBeatLabel(last) === storyBeatLabel(clip);
  return currentGroup.length >= 2 && !sameScene && !sameBeat;
}

function buildGroups(orderedClips) {
  const groups = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const duration = current.reduce((sum, item) => sum + durationOf(item), 0);
    const beat = storyBeatLabel(first);
    const scene = normalizeText(first.scene);
    groups.push({
      id: `group-${groups.length + 1}`,
      title: scene ? `${beat} - ${scene}` : beat,
      storyBeat: beat,
      scene,
      clip_ids: current.map((clip) => clip.id),
      duration: Number(duration.toFixed(3)),
      reason: current.length === 1
        ? "Single long or distinct narrative beat."
        : "Grouped by adjacent story beat, scene, or visual continuity.",
    });
    current = [];
  };

  for (const clip of orderedClips) {
    if (durationOf(clip) >= 10) {
      flush();
      current = [clip];
      flush();
      continue;
    }
    if (shouldStartNewGroup(current, clip)) flush();
    current.push(clip);
  }
  flush();
  return groups;
}

function buildTimeline(orderedClips) {
  let cursor = 0;
  return orderedClips.map((clip, index) => {
    const duration = durationOf(clip);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    return {
      index: index + 1,
      videoNodeId: clip.id,
      storyBeat: storyBeatLabel(clip),
      summary: truncateText(clip.summary || clip.name || "Video clip", 260),
      reason: buildReason(clip),
      duration: duration || null,
      timelineWindow: duration > 0
        ? { start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) }
        : null,
      source: {
        name: normalizeText(clip.name),
        prompt: truncateText(clip.prompt, 360),
        knownShotIndex: hasShotIndex(clip) ? shotIndex(clip) : null,
      },
    };
  });
}

function buildReason(clip) {
  if (hasShotIndex(clip)) return `Placed by explicit shot index ${shotIndex(clip)}.`;
  const beat = storyBeatLabel(clip);
  if (beat && beat !== "core") return `Placed by story signal: ${beat}.`;
  if (normalizeText(clip.scene)) return "Placed near clips from the same scene for visual continuity.";
  return "Placed by canvas position and input order fallback.";
}

function confidenceForPlan(clips, orderedClips, intent) {
  if (!clips.length) return 0;
  let confidence = 0.42;
  const indexedRatio = clips.filter(hasShotIndex).length / clips.length;
  const signalRatio = clips.filter((clip) => storySignalsOf(clip).length > 0 || normalizeText(clip.storyBeat)).length / clips.length;
  const sceneRatio = clips.filter((clip) => normalizeText(clip.scene)).length / clips.length;
  confidence += indexedRatio * 0.28;
  confidence += signalRatio * 0.16;
  confidence += sceneRatio * 0.08;
  if (intent !== "default") confidence += 0.08;
  if (orderedClips.every((clip, index) => clip.id === clips[index]?.id) && indexedRatio === 0 && signalRatio === 0) confidence -= 0.08;
  return Math.max(0.25, Math.min(0.95, Number(confidence.toFixed(2))));
}

function orderSource(clips, intent) {
  if (intent !== "default") return `userIntent:${intent}`;
  if (clips.some(hasShotIndex)) return "shotIndex";
  if (clips.some((clip) => storySignalsOf(clip).length > 0 || normalizeText(clip.storyBeat))) return "storySignals";
  if (clips.some((clip) => normalizeText(clip.scene))) return "sceneAndCanvasPosition";
  return "canvasPosition";
}

export function planVideoOrder(args = {}) {
  const { clips, duplicateIds } = uniqueClips(args.clips);
  const warnings = [];
  if (duplicateIds.length > 0) warnings.push(`Duplicate clip ids ignored: ${duplicateIds.join(", ")}`);
  if (clips.length === 0) {
    return {
      version: 1,
      intent: normalizeText(args.userIntent),
      groups: [],
      orderedIds: [],
      timeline: [],
      orderSource: "none",
      confidence: 0,
      warnings: ["No clips were provided."],
    };
  }

  const intent = detectIntent(args.userIntent);
  const orderedClips = sortForIntent(clips, intent);
  const groups = buildGroups(orderedClips);
  const orderedIds = groups.flatMap((group) => group.clip_ids);
  const orderedSet = new Set(orderedIds);
  for (const clip of orderedClips) {
    if (!orderedSet.has(clip.id)) orderedIds.push(clip.id);
  }

  const finalClipsById = new Map(orderedClips.map((clip) => [clip.id, clip]));
  const finalOrderedClips = orderedIds.map((id) => finalClipsById.get(id)).filter(Boolean);
  if (!clips.some(hasShotIndex) && !clips.some((clip) => storySignalsOf(clip).length > 0)) {
    warnings.push("No explicit shot index or story signal found; used scene, canvas position, and input order fallback.");
  }

  return {
    version: 1,
    intent: normalizeText(args.userIntent),
    groups,
    orderedIds,
    timeline: buildTimeline(finalOrderedClips),
    orderSource: orderSource(clips, intent),
    confidence: confidenceForPlan(clips, finalOrderedClips, intent),
    warnings,
  };
}
