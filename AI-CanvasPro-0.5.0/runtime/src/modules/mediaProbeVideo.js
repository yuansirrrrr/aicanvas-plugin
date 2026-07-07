import { fetchVideoMetaFromServer } from "../../api/videoMetaApi.js";
import { localPathToUrl, normalizeLocalPath } from "../utils/localMediaPath.js";
import { normalizeText } from "./storyline/canvasNodeSnapshot.js";

const TOP_LEVEL_VIDEO_FIELDS = [
  "originalLocalPath",
  "localPath",
  "displayLocalPath",
  "videoUrl",
  "src",
  "url",
  "resultUrl",
  "videoMetaSrc",
];

const NESTED_VIDEO_FIELDS = [
  "originalLocalPath",
  "localPath",
  "displayLocalPath",
  "videoUrl",
  "src",
  "url",
  "resultUrl",
];

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function isRemoteHttp(value) {
  return /^https?:\/\//i.test(normalizeText(value)) && !normalizeLocalPath(value);
}

function isUnsupportedLocalPath(value) {
  const text = normalizeText(value).replace(/\\/g, "/");
  if (!text) return false;
  if (/^(?:data|blob|file|javascript):/i.test(text)) return true;
  if (/^[a-zA-Z]:\//.test(text)) return true;
  if (text.startsWith("//")) return true;
  if (text.startsWith("/") && !/^\/?(?:output\/|data\/uploads\/|data\/assets\/)/.test(text)) return true;
  return false;
}

function addCandidate(candidates, field, value) {
  const text = normalizeText(value);
  if (!text) return;
  candidates.push({ field, value: text });
}

export function collectVideoSourceCandidates(node = {}) {
  const candidates = [];
  for (const field of TOP_LEVEL_VIDEO_FIELDS) addCandidate(candidates, field, node?.[field]);

  const videos = Array.isArray(node?.videos) ? node.videos : [];
  if (videos.length > 0) {
    const rawMainIndex = Number(node?.mainVideoIndex);
    const mainIndex = Number.isInteger(rawMainIndex) && rawMainIndex >= 0 && rawMainIndex < videos.length
      ? rawMainIndex
      : 0;
    const mainVideo = videos[mainIndex];
    for (const field of NESTED_VIDEO_FIELDS) {
      addCandidate(candidates, `videos[${mainIndex}].${field}`, mainVideo?.[field]);
    }
    videos.forEach((video, index) => {
      if (index === mainIndex) return;
      for (const field of NESTED_VIDEO_FIELDS) addCandidate(candidates, `videos[${index}].${field}`, video?.[field]);
    });
  }
  return candidates;
}

export function resolveVideoNodeSource(node = {}) {
  const candidates = collectVideoSourceCandidates(node);
  let remoteCandidate = null;
  let unsupportedCandidate = null;

  for (const candidate of candidates) {
    const localPath = normalizeLocalPath(candidate.value);
    if (localPath) {
      return {
        ok: true,
        localPath,
        src: localPathToUrl(localPath) || `/${localPath}`,
        sourceFields: [candidate.field],
      };
    }
    if (!remoteCandidate && isRemoteHttp(candidate.value)) remoteCandidate = candidate;
    if (!unsupportedCandidate && isUnsupportedLocalPath(candidate.value)) unsupportedCandidate = candidate;
  }

  if (remoteCandidate) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_REMOTE_VIDEO",
      message: "Remote video URLs are not supported by media.probeVideo in this version.",
      sourceFields: [remoteCandidate.field],
    };
  }

  if (unsupportedCandidate) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_LOCAL_VIDEO_PATH",
      message: "Video path is not a CanvasPro virtual local path.",
      sourceFields: [unsupportedCandidate.field],
    };
  }

  return {
    ok: false,
    errorCode: "VIDEO_PATH_NOT_FOUND",
    message: "Cannot resolve local video path from node.",
    sourceFields: candidates.map((candidate) => candidate.field),
  };
}

export async function probeVideoNode(node = {}) {
  const id = normalizeText(node.id);
  const source = resolveVideoNodeSource(node);
  if (!source.ok) {
    return {
      id,
      ok: false,
      errorCode: source.errorCode,
      message: source.message,
      sourceFields: source.sourceFields || [],
    };
  }

  try {
    const meta = await fetchVideoMetaFromServer(source.src || source.localPath);
    return {
      id,
      ok: true,
      localPath: source.localPath,
      src: source.src,
      duration: toPositiveNumber(meta?.duration ?? node.videoDuration ?? node.duration),
      width: toPositiveInteger(meta?.width ?? node.videoWidth ?? node.width),
      height: toPositiveInteger(meta?.height ?? node.videoHeight ?? node.height),
      fps: toPositiveNumber(meta?.fps ?? node.videoFps ?? node.fps),
      frameCount: toPositiveInteger(meta?.frameCount),
      hasAudio: typeof meta?.hasAudio === "boolean" ? meta.hasAudio : null,
      sourceFields: source.sourceFields,
    };
  } catch (error) {
    return {
      id,
      ok: false,
      localPath: source.localPath,
      src: source.src,
      errorCode: "VIDEO_METADATA_FAILED",
      message: error?.message || "Failed to read video metadata.",
      sourceFields: source.sourceFields,
    };
  }
}

export async function probeVideoNodes(ids = [], nodes = {}) {
  const videos = [];
  for (const rawId of ids) {
    const id = normalizeText(rawId);
    const node = nodes?.[id];
    if (!node) {
      videos.push({
        id,
        ok: false,
        errorCode: "NODE_NOT_FOUND",
        message: `Canvas node not found: ${id}`,
        sourceFields: [],
      });
      continue;
    }
    videos.push(await probeVideoNode({ ...node, id: node.id || id }));
  }
  return {
    videos,
    errors: videos.filter((video) => !video.ok),
  };
}
