const MEDIA_OMIT_KEYS = new Set([
  "base64",
  "dataUrl",
  "imageBase64",
  "videoBase64",
  "audioBase64",
  "thumbnailBase64",
  "blob",
  "file",
  "frames",
]);

const VIDEO_SOURCE_FIELDS = [
  "originalLocalPath",
  "localPath",
  "displayLocalPath",
  "videoUrl",
  "src",
  "url",
  "resultUrl",
  "videoMetaSrc",
];

const SIMPLE_NODE_FIELDS = [
  "id",
  "type",
  "name",
  "model",
  "modelId",
  "provider",
  "jobStatus",
  "sourceId",
  "sourceUrl",
  "fileName",
  "assetId",
  "thumbId",
];

export function getCanvasState(context = {}) {
  return context?.store?.getStateRaw?.() || context?.store?.getState?.() || {};
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function stripHtml(value) {
  return normalizeText(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function truncateText(value, maxLength = 600) {
  const text = stripHtml(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasOwn(object, key) {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
}

function sanitizeString(value, maxLength = 1200) {
  const text = normalizeText(value);
  if (!text) return "";
  if (/^(?:data|blob):/i.test(text)) return "[omitted]";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

export function sanitizeStructured(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  if (depth > 3) return "[omitted]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeStructured(item, depth + 1, seen));
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (MEDIA_OMIT_KEYS.has(key)) {
      result[key] = "[omitted]";
      continue;
    }
    if (key === "images" || key === "audios") {
      result[key] = Array.isArray(item) ? `[array:${item.length}]` : "[omitted]";
      continue;
    }
    result[key] = sanitizeStructured(item, depth + 1, seen);
  }
  return result;
}

function pickVideoItemFields(video = {}) {
  if (!video || typeof video !== "object") return {};
  const picked = {};
  for (const key of [
    ...VIDEO_SOURCE_FIELDS,
    "width",
    "height",
    "duration",
    "videoWidth",
    "videoHeight",
    "videoDuration",
    "videoFps",
    "fps",
    "fileName",
    "name",
  ]) {
    if (hasOwn(video, key)) picked[key] = sanitizeStructured(video[key]);
  }
  return picked;
}

function buildEdgeSummary(edge = {}) {
  return {
    id: normalizeText(edge.id),
    sourceId: normalizeText(edge.sourceId || edge.source),
    targetId: normalizeText(edge.targetId || edge.target),
    refSlot: normalizeText(edge.refSlot || edge.slot || edge.inputSlot),
    type: normalizeText(edge.type),
  };
}

export function isVideoNodeCandidate(node = {}) {
  const type = normalizeText(node.type).toLowerCase();
  if (type === "source-video" || type === "ai-video" || type === "video") return true;
  if (Array.isArray(node.videos) && node.videos.length > 0) return true;
  return VIDEO_SOURCE_FIELDS.some((field) => normalizeText(node?.[field]));
}

export function buildNodeSnapshot(node = {}, state = {}) {
  const id = normalizeText(node.id);
  const edges = Object.values(state.edges || {});
  const incomingEdges = edges
    .filter((edge) => normalizeText(edge?.targetId || edge?.target) === id)
    .map(buildEdgeSummary);
  const outgoingEdges = edges
    .filter((edge) => normalizeText(edge?.sourceId || edge?.source) === id)
    .map(buildEdgeSummary);
  const snapshot = {};

  for (const key of SIMPLE_NODE_FIELDS) {
    if (hasOwn(node, key)) snapshot[key] = sanitizeStructured(node[key]);
  }

  snapshot.id = id;
  snapshot.type = normalizeText(node.type);
  snapshot.name = normalizeText(node.name);
  snapshot.prompt = truncateText(node.prompt || node.params?.prompt || node.generationParams?.prompt, 2200);
  snapshot.text = truncateText(node.text, 1200);
  snapshot.content = truncateText(node.content, 1200);
  snapshot.promptPreview = truncateText(snapshot.prompt, 220);
  snapshot.contentPreview = truncateText(snapshot.content || snapshot.text, 220);

  for (const key of VIDEO_SOURCE_FIELDS) {
    if (hasOwn(node, key)) snapshot[key] = sanitizeStructured(node[key]);
  }

  if (Array.isArray(node.videos)) {
    snapshot.videos = node.videos.slice(0, 20).map(pickVideoItemFields);
    if (hasOwn(node, "mainVideoIndex")) snapshot.mainVideoIndex = toFiniteNumber(node.mainVideoIndex, 0);
  }

  snapshot.x = toFiniteNumber(node.x, 0);
  snapshot.y = toFiniteNumber(node.y, 0);
  snapshot.width = toFiniteNumber(node.width, 0);
  snapshot.height = toFiniteNumber(node.height, 0);

  if (node.metadata && typeof node.metadata === "object") snapshot.metadata = sanitizeStructured(node.metadata);
  if (node.meta && typeof node.meta === "object") snapshot.meta = sanitizeStructured(node.meta);
  if (node.params && typeof node.params === "object") snapshot.params = sanitizeStructured(node.params);
  if (node.generationParams && typeof node.generationParams === "object") {
    snapshot.generationParams = sanitizeStructured(node.generationParams);
  }

  snapshot.incomingEdges = incomingEdges;
  snapshot.outgoingEdges = outgoingEdges;
  snapshot.linkedNodeIds = Array.from(new Set([
    ...incomingEdges.map((edge) => edge.sourceId),
    ...outgoingEdges.map((edge) => edge.targetId),
  ].filter(Boolean)));

  return snapshot;
}

export function buildSelectedNodeSnapshots(context = {}, ids = [], options = {}) {
  const state = getCanvasState(context);
  const nodes = state.nodes || {};
  const mediaKind = normalizeText(options.mediaKind || "video").toLowerCase();
  const sourceIds = Array.isArray(ids) ? ids : [];
  const snapshots = [];
  const missingIds = [];
  const filteredOutIds = [];

  for (const rawId of sourceIds) {
    const id = normalizeText(rawId);
    if (!id) continue;
    const node = nodes[id];
    if (!node) {
      missingIds.push(id);
      continue;
    }
    if (mediaKind === "video" && !isVideoNodeCandidate(node)) {
      filteredOutIds.push(id);
      continue;
    }
    snapshots.push(buildNodeSnapshot(node, state));
  }

  return { state, nodes: snapshots, missingIds, filteredOutIds };
}
