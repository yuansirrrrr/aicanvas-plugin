const durationOptions = Object.freeze([4, 6, 8, 10].map((value) => Object.freeze({
  value,
  label: `${value}s`,
  displayLabel: `${value}S`,
})));

const aspectRatioOptions = Object.freeze(["16:9", "9:16"].map((value) => Object.freeze({
  value,
  label: value,
})));

const resolutionOptions = Object.freeze(["720p", "1080p"].map((value) => Object.freeze({
  value,
  label: value,
})));

export const deeprouterVeo31VideoModelManifest = Object.freeze({
  schemaVersion: "1.0",
  modelId: "deeprouterai/veo-3.1-generate-preview",
  provider: "deeprouterai",
  kind: "video",
  adapterType: "modelApi",
  executionId: "deeprouterai.model-api.video.veo-3-1-generate-preview.v1",
  displayName: "Veo 3.1 Generate Preview",
  icon: "DR",
  description: "DeepRouterAI Veo 3.1 video generation model API",
  inputSlots: Object.freeze({
    allowedKinds: Object.freeze(["text", "image", "video", "audio"]),
    minByKind: Object.freeze({ text: 0 }),
    maxByKind: Object.freeze({ image: 3, video: 1, audio: 1 }),
    fixedSlots: Object.freeze([]),
  }),
  uiSchema: Object.freeze({
    fields: Object.freeze([
      Object.freeze({
        id: "duration",
        type: "slider",
        placement: "resolution",
        variant: "durationPill",
        label: "视频时长",
        defaultValue: 4,
        min: 4,
        max: 10,
        step: 1,
        options: durationOptions,
      }),
      Object.freeze({
        id: "aspectRatio",
        displayRole: "aspectRatio",
        type: "segmented",
        placement: "resolution",
        variant: "ratioPill",
        label: "比例",
        defaultValue: "16:9",
        options: aspectRatioOptions,
      }),
      Object.freeze({
        id: "resolution",
        type: "segmented",
        placement: "resolution",
        variant: "sectionMenu",
        label: "视频分辨率",
        defaultValue: "720p",
        options: resolutionOptions,
      }),
    ]),
    footerPlacementOrder: Object.freeze(["resolution"]),
  }),
  prompt: Object.freeze({
    placeholder: "描述视频内容、动作、环境、镜头运动和声音。",
  }),
  help: Object.freeze({
    tooltip: "DeepRouterAI Veo 3.1 Generate Preview\n支持文本、图片、视频和音频参考；时长 4 / 6 / 8 / 10 秒。",
  }),
  async: true,
  cancellable: false,
  outputType: "video",
  extensions: Object.freeze({
    ratioPolicy: Object.freeze({ capability: "size" }),
    videoMenu: Object.freeze({
      role: "deeprouteraiModel",
      order: 10,
      label: "Veo 3.1 Generate Preview",
      subtitle: "DeepRouterAI Veo 3.1",
    }),
  }),
});

export const deeprouterVeo31VideoExecutionManifest = Object.freeze({
  schemaVersion: "1.0",
  id: "deeprouterai.model-api.video.veo-3-1-generate-preview.v1",
  provider: "deeprouterai",
  kind: "video",
  adapterType: "modelApi",
  endpoint: "/v1/video/generations",
  endpointMode: "video-generation",
  method: "POST",
  model: "veo-3.1-generate-preview",
  extensions: Object.freeze({
    bodyResolver: "deeprouterVeo31Video",
    authHeaderMode: "raw",
    taskPolling: Object.freeze({
      mode: "task-proxy",
      method: "GET",
      urlTemplate: "{baseUrl}/v1/video/generations/{taskId}",
      headersMode: "raw",
    }),
  }),
  headers: Object.freeze({
    "Content-Type": "application/json",
  }),
  bodyMapping: Object.freeze([
    Object.freeze({ path: "model", from: "model" }),
    Object.freeze({ path: "prompt", from: "prompt" }),
    Object.freeze({
      path: "metadata.durationSeconds",
      from: "param",
      field: Object.freeze(["generationParams.duration", "duration"]),
      defaultValue: 4,
    }),
    Object.freeze({
      path: "metadata.aspectRatio",
      from: "param",
      field: Object.freeze(["generationParams.aspectRatio", "aspectRatio"]),
      defaultValue: "16:9",
    }),
    Object.freeze({
      path: "metadata.resolution",
      from: "param",
      field: Object.freeze(["generationParams.resolution", "resolution"]),
      defaultValue: "720p",
    }),
  ]),
  responseMapping: Object.freeze({
    taskIdPath: Object.freeze(["id", "task_id", "taskId", "data.id", "data.task_id", "data.taskId"]),
    statusPath: "status",
    errorPath: Object.freeze(["error.message", "error", "message"]),
    resultPaths: Object.freeze([
      "url",
      "video_url",
      "result.video_url",
      "result.videos[].url",
      "data.url",
      "data.video_url",
      "data.result.video_url",
      "data.result.videos[].url",
    ]),
  }),
  result: Object.freeze({
    taskIdPath: "id",
    urlFields: Object.freeze(["videoUrl", "video_url", "url"]),
  }),
});
