import {
  getCanvasState,
  isVideoNodeCandidate,
  normalizeText,
  stripHtml,
  toFiniteNumber,
  truncateText,
} from "./canvasNodeSnapshot.js";

const SHOT_INDEX_KEYS = [
  "shotIndex",
  "shotNumber",
  "shotNo",
  "sceneIndex",
  "clipIndex",
  "index",
];

const SCENE_KEYS = ["scene", "sceneName", "location", "place", "environment"];
const CHARACTER_KEYS = ["characters", "characterNames", "character", "protagonist", "role"];

const STORY_SIGNAL_RULES = [
  { label: "opening", pattern: /opening|intro|start|setup|establish|\u5f00\u573a|\u5f00\u5934|\u5efa\u7acb|\u51fa\u573a/i },
  { label: "discovery", pattern: /discover|reveal|notice|find|\u53d1\u73b0|\u770b\u5230|\u5bdf\u89c9|\u7ebf\u7d22/i },
  { label: "conflict", pattern: /conflict|danger|attack|escape|chase|fight|\u51b2\u7a81|\u5371\u9669|\u9003|\u8ffd|\u6253/i },
  { label: "climax", pattern: /climax|turning point|twist|shock|explode|\u9ad8\u6f6e|\u53cd\u8f6c|\u9707\u60ca|\u7206\u53d1|\u60ca\u5413/i },
  { label: "ending", pattern: /ending|final|resolution|leave|aftermath|\u7ed3\u5c3e|\u7ed3\u675f|\u6536\u675f|\u79bb\u5f00|\u4f59\u97f5/i },
  { label: "atmosphere", pattern: /mood|vibe|atmosphere|quiet|detail|\u6c1b\u56f4|\u60c5\u7eea|\u7ec6\u8282|\u7a7a\u955c/i },
];

const SHOT_INDEX_PATTERNS = [
  /(?:shot|clip|scene|take)\s*#?\s*(\d{1,4})/i,
  /(?:\u955c\u5934|\u5206\u955c)\s*#?\s*(\d{1,4})/i,
  /\u7b2c\s*(\d{1,4})\s*(?:\u4e2a)?(?:\u955c\u5934|\u5206\u955c)/i,
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function uniqueStrings(values = [], max = 12) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = stripHtml(value);
    if (!text || seen.has(text)) continue;
    out.push(text);
    seen.add(text);
    if (out.length >= max) break;
  }
  return out;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = stripHtml(value);
    if (text) return text;
  }
  return "";
}

function collectMetadataObjects(...sources) {
  const objects = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of ["metadata", "meta", "params", "generationParams", "story", "storyboard"]) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) objects.push(value);
    }
    objects.push(source);
  }
  return objects;
}

function extractShotIndexFromObject(object) {
  if (!object || typeof object !== "object") return null;
  for (const key of SHOT_INDEX_KEYS) {
    const number = Number(object[key]);
    if (Number.isFinite(number) && number > 0) return Math.round(number);
  }
  return null;
}

function extractShotIndexFromText(text) {
  const source = normalizeText(text);
  if (!source) return null;
  for (const pattern of SHOT_INDEX_PATTERNS) {
    const match = source.match(pattern);
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isFinite(number) && number > 0) return Math.round(number);
  }
  return null;
}

function extractKnownShotIndex(node, linkedNodes) {
  for (const object of collectMetadataObjects(node, ...linkedNodes)) {
    const direct = extractShotIndexFromObject(object);
    if (direct) return direct;
  }
  for (const item of [node, ...linkedNodes]) {
    const fromText = extractShotIndexFromText([
      item?.name,
      item?.prompt,
      item?.text,
      item?.content,
      item?.fileName,
    ].filter(Boolean).join(" "));
    if (fromText) return fromText;
  }
  return null;
}

function extractStorySignals(node, linkedNodes) {
  const directSignals = [];
  for (const object of collectMetadataObjects(node, ...linkedNodes)) {
    directSignals.push(...asArray(object.storySignals));
    directSignals.push(object.storyBeat, object.beat, object.phase);
  }

  const allText = [node, ...linkedNodes]
    .flatMap((item) => [item?.name, item?.prompt, item?.text, item?.content, item?.metadata?.storyBeat])
    .filter(Boolean)
    .join(" ");

  for (const rule of STORY_SIGNAL_RULES) {
    if (rule.pattern.test(allText)) directSignals.push(rule.label);
  }
  return uniqueStrings(directSignals, 8);
}

function extractCharacters(node, linkedNodes) {
  const values = [];
  for (const object of collectMetadataObjects(node, ...linkedNodes)) {
    for (const key of CHARACTER_KEYS) values.push(...asArray(object[key]));
  }
  for (const linked of linkedNodes) {
    const type = normalizeText(linked?.type).toLowerCase();
    if (type.includes("character")) values.push(linked?.name);
  }
  return uniqueStrings(values, 10);
}

function extractScene(node, linkedNodes) {
  for (const object of collectMetadataObjects(node, ...linkedNodes)) {
    for (const key of SCENE_KEYS) {
      const text = firstNonEmpty(object[key]);
      if (text) return truncateText(text, 160);
    }
  }
  for (const linked of linkedNodes) {
    const type = normalizeText(linked?.type).toLowerCase();
    if (type.includes("scene")) {
      const text = firstNonEmpty(linked?.name, linked?.prompt, linked?.content);
      if (text) return truncateText(text, 160);
    }
  }
  return "";
}

function collectLinkedNodes(node, state) {
  const nodeId = normalizeText(node?.id);
  const nodes = state.nodes || {};
  const edges = Object.values(state.edges || {});
  const linkedIds = new Set();

  for (const edge of edges) {
    const sourceId = normalizeText(edge?.sourceId || edge?.source);
    const targetId = normalizeText(edge?.targetId || edge?.target);
    if (targetId === nodeId && sourceId) linkedIds.add(sourceId);
    if (sourceId === nodeId && targetId) linkedIds.add(targetId);
  }

  for (const linkedId of Array.from(linkedIds)) {
    for (const edge of edges) {
      const sourceId = normalizeText(edge?.sourceId || edge?.source);
      const targetId = normalizeText(edge?.targetId || edge?.target);
      if (targetId === linkedId && sourceId) linkedIds.add(sourceId);
    }
  }

  return Array.from(linkedIds)
    .map((id) => nodes[id])
    .filter(Boolean)
    .slice(0, 16);
}

function findStoryboardPrompt(node, linkedNodes) {
  const linkedPriority = linkedNodes
    .filter((linked) => {
      const type = normalizeText(linked?.type).toLowerCase();
      return type.includes("storyboard") || type.includes("image") || type.includes("reference");
    })
    .map((linked) => firstNonEmpty(linked?.prompt, linked?.content, linked?.text, linked?.name))
    .find(Boolean);
  return linkedPriority || firstNonEmpty(node?.metadata?.sourcePrompt, node?.metadata?.storyPrompt);
}

function resolveDuration(node, inputClip, probeItem) {
  return toFiniteNumber(
    probeItem?.duration
      ?? inputClip?.duration
      ?? node?.videoDuration
      ?? node?.duration
      ?? node?.metadata?.duration,
    null,
  );
}

function confidenceForClip({ summary, knownShotIndex, storySignals, linkedNodes, scene, characters }) {
  let confidence = 0.42;
  if (summary) confidence += 0.12;
  if (knownShotIndex) confidence += 0.2;
  if (storySignals.length > 0) confidence += 0.1;
  if (linkedNodes.length > 0) confidence += 0.08;
  if (scene) confidence += 0.04;
  if (characters.length > 0) confidence += 0.04;
  return Math.max(0.2, Math.min(0.95, Number(confidence.toFixed(2))));
}

function buildClipDescription(node, state, { inputClip = {}, probeItem = null } = {}) {
  const linkedNodes = collectLinkedNodes(node, state);
  const summary = truncateText(
    firstNonEmpty(
      inputClip.summary,
      findStoryboardPrompt(node, linkedNodes),
      node?.prompt,
      node?.text,
      node?.content,
      node?.name,
      inputClip.name,
      "Unnamed video clip",
    ),
    320,
  );
  const storySignals = extractStorySignals({ ...inputClip, ...node }, linkedNodes);
  const knownShotIndex = inputClip.knownShotIndex || extractKnownShotIndex({ ...inputClip, ...node }, linkedNodes);
  const scene = inputClip.scene || extractScene({ ...inputClip, ...node }, linkedNodes);
  const characters = uniqueStrings([
    ...asArray(inputClip.characters),
    ...extractCharacters({ ...inputClip, ...node }, linkedNodes),
  ]);
  const duration = resolveDuration(node, inputClip, probeItem);
  const linkedNodeIds = linkedNodes.map((linked) => normalizeText(linked.id)).filter(Boolean);
  const clip = {
    id: normalizeText(node.id || inputClip.id),
    name: firstNonEmpty(inputClip.name, node.name),
    summary,
    prompt: truncateText(firstNonEmpty(inputClip.prompt, node.prompt, node.params?.prompt, node.generationParams?.prompt), 1600),
    characters,
    scene,
    storySignals,
    knownShotIndex: knownShotIndex || null,
    duration,
    canvasPosition: {
      x: toFiniteNumber(node.x, inputClip.canvasPosition?.x ?? 0),
      y: toFiniteNumber(node.y, inputClip.canvasPosition?.y ?? 0),
    },
    linkedNodes: linkedNodeIds,
  };
  clip.sourceConfidence = confidenceForClip({
    summary,
    knownShotIndex,
    storySignals,
    linkedNodes,
    scene,
    characters,
  });
  return clip;
}

function buildProbeMap(probe) {
  const map = new Map();
  const videos = Array.isArray(probe?.videos) ? probe.videos : Array.isArray(probe) ? probe : [];
  for (const video of videos) {
    const id = normalizeText(video?.id);
    if (id) map.set(id, video);
  }
  return map;
}

export function describeStorylineClips(args = {}, context = {}) {
  const state = getCanvasState(context);
  const nodes = state.nodes || {};
  const selectedNodeIds = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds : [];
  const inputClips = Array.isArray(args.clips) ? args.clips : [];
  const idsFromClips = inputClips.map((clip) => normalizeText(clip?.id)).filter(Boolean);
  const requestedIds = Array.isArray(args.ids) && args.ids.length > 0 ? args.ids : idsFromClips.length ? idsFromClips : selectedNodeIds;
  const uniqueIds = Array.from(new Set(requestedIds.map(normalizeText).filter(Boolean)));
  const probeMap = buildProbeMap(args.probe);
  const inputClipById = new Map(inputClips.map((clip) => [normalizeText(clip?.id), clip]).filter(([id]) => id));
  const clips = [];
  const warnings = [];

  for (const id of uniqueIds) {
    const node = nodes[id];
    const inputClip = inputClipById.get(id) || {};
    if (!node && !inputClip.id) {
      warnings.push(`Canvas node not found: ${id}`);
      continue;
    }
    if (node && !isVideoNodeCandidate(node) && !inputClip.id) {
      warnings.push(`Skipped non-video node: ${id}`);
      continue;
    }
    clips.push(buildClipDescription({ ...(node || {}), ...(!node ? { id } : {}) }, state, {
      inputClip,
      probeItem: probeMap.get(id) || null,
    }));
  }

  return {
    clips,
    userIntent: normalizeText(args.userIntent),
    warnings,
  };
}
