import {
  buildSelectedNodeSnapshots,
  getCanvasState,
  normalizeText,
} from "../storyline/canvasNodeSnapshot.js";
import { describeStorylineClips } from "../storyline/describeClips.js";
import { planVideoOrder } from "../storyline/planVideoOrder.js";

function normalizeIds(value) {
  const ids = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const id of ids) {
    const text = normalizeText(id);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function selectedIdsFromContext(context = {}) {
  const selectedNodeIds = getCanvasState(context).selectedNodeIds;
  return normalizeIds(Array.isArray(selectedNodeIds) ? selectedNodeIds : []);
}

function validateExistingIds(ids, context) {
  const nodes = getCanvasState(context).nodes || {};
  const missingIds = ids.filter((id) => !nodes[id]);
  if (missingIds.length > 0) {
    return {
      ok: false,
      errorCode: "NODE_NOT_FOUND",
      message: `Canvas node(s) not found: ${missingIds.join(", ")}`,
      details: { missingIds },
    };
  }
  return { ok: true };
}

export function registerStorylineCommands(registry) {
  registry.register({
    id: "canvas.getSelectedNodes",
    description: "Return safe snapshots for currently selected canvas video nodes.",
    riskLevel: "safe",
    argsSchema: {
      properties: {
        ids: { type: "array", items: { type: "string" } },
        mediaKind: { type: "string", enum: ["video", "all"] },
      },
      defaults: {
        mediaKind: "video",
      },
      selectionFallback: true,
    },
    capabilitySchema: {
      reads: ["nodes", "edges", "selection"],
      writes: [],
      selectionFallback: true,
    },
    returnSchema: {
      aliasFields: ["selectedNodeIds", "ids", "nodes", "nodeCount"],
    },
    validate(args = {}, context = {}) {
      const ids = normalizeIds(args.ids?.length ? args.ids : selectedIdsFromContext(context));
      const mediaKind = normalizeText(args.mediaKind || "video").toLowerCase() === "all" ? "all" : "video";
      const nodeValidation = validateExistingIds(ids, context);
      if (!nodeValidation.ok) return nodeValidation;
      return { args: { ids, mediaKind } };
    },
    execute(args = {}, context = {}) {
      const state = getCanvasState(context);
      const selectedNodeIds = selectedIdsFromContext(context);
      const snapshots = buildSelectedNodeSnapshots(context, args.ids, { mediaKind: args.mediaKind });
      return {
        selectedNodeIds,
        ids: snapshots.nodes.map((node) => node.id),
        mediaKind: args.mediaKind,
        nodes: snapshots.nodes,
        nodeCount: snapshots.nodes.length,
        missingIds: snapshots.missingIds,
        filteredOutIds: snapshots.filteredOutIds,
        edgeCount: Object.keys(state.edges || {}).length,
      };
    },
  });

  registry.register({
    id: "storyline.describeClips",
    description: "Describe selected video nodes as storyline clips for narrative ordering.",
    riskLevel: "safe",
    argsSchema: {
      properties: {
        ids: { type: "array", items: { type: "string" } },
        clips: { type: "array" },
        probe: { type: "object" },
        userIntent: { type: "string" },
      },
      selectionFallback: true,
    },
    capabilitySchema: {
      reads: ["nodes", "edges", "selection"],
      writes: [],
      selectionFallback: true,
    },
    returnSchema: {
      aliasFields: ["clips", "warnings"],
    },
    validate(args = {}, context = {}) {
      const hasInputClips = Array.isArray(args.clips) && args.clips.length > 0;
      const ids = normalizeIds(args.ids?.length ? args.ids : hasInputClips ? args.clips.map((clip) => clip?.id) : selectedIdsFromContext(context));
      if (ids.length < 1 && !hasInputClips) {
        return {
          ok: false,
          errorCode: "NO_VIDEO_CLIPS",
          message: "storyline.describeClips requires selected video nodes or clip inputs.",
        };
      }
      const nodeValidation = validateExistingIds(ids.filter((id) => getCanvasState(context).nodes?.[id]), context);
      if (!nodeValidation.ok) return nodeValidation;
      return {
        args: {
          ids,
          clips: Array.isArray(args.clips) ? args.clips : [],
          probe: args.probe && typeof args.probe === "object" ? args.probe : null,
          userIntent: normalizeText(args.userIntent),
        },
      };
    },
    execute(args = {}, context = {}) {
      return describeStorylineClips(args, context);
    },
  });

  registry.register({
    id: "storyline.planVideoOrder",
    description: "Plan narrative video order and timeline from described storyline clips.",
    riskLevel: "safe",
    argsSchema: {
      required: ["clips"],
      properties: {
        clips: { type: "array" },
        userIntent: { type: "string" },
      },
    },
    capabilitySchema: {
      reads: [],
      writes: [],
    },
    returnSchema: {
      aliasFields: ["orderedIds", "timeline", "groups", "confidence"],
    },
    validate(args = {}) {
      const clips = Array.isArray(args.clips) ? args.clips : [];
      const ids = normalizeIds(clips.map((clip) => clip?.id || clip?.videoNodeId));
      if (clips.length < 1 || ids.length < 1) {
        return {
          ok: false,
          errorCode: "NO_STORYLINE_CLIPS",
          message: "storyline.planVideoOrder requires at least one clip with an id.",
        };
      }
      return {
        args: {
          clips,
          userIntent: normalizeText(args.userIntent),
        },
      };
    },
    execute(args = {}) {
      return planVideoOrder(args);
    },
  });
}
