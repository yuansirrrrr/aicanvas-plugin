import {
  APIMART_NANO_BANANA_IMAGE_SIZE_FIELD,
  APIMART_QWEN_IMAGE_RATIO_FIELD,
  createImageModelApiManifest,
  createModelApiExecutionManifest,
} from "./sharedImageModelApiFields.js";

const AGNES_IMAGE_INPUT_SLOTS = Object.freeze({
  allowedKinds: Object.freeze(["text", "image"]),
  minByKind: Object.freeze({
    text: 0,
    image: 0,
  }),
  maxByKind: Object.freeze({
    image: 8,
    video: 0,
    audio: 0,
  }),
});

const AGNES_IMAGE_BODY_MAPPING = Object.freeze([
  Object.freeze({
    path: "model",
    from: "model",
  }),
  Object.freeze({
    path: "prompt",
    from: "prompt",
  }),
  Object.freeze({
    path: "size",
    from: "param",
    field: Object.freeze([
      "generationParams.aspectRatio",
      "resolvedRatioLabel",
      "aspectRatio",
    ]),
    defaultValue: "4:3",
    transform: "agnesImageSize",
  }),
  Object.freeze({
    path: "extra_body.image",
    from: "inputImages",
    omitWhenEmpty: true,
  }),
]);

const AGNES_IMAGE_RESPONSE_MAPPING = Object.freeze({
  taskIdPath: Object.freeze([
    "task_id",
    "taskId",
    "id",
    "data.task_id",
    "data.taskId",
    "data.id",
  ]),
  statusPath: "status",
  errorPath: Object.freeze(["error.message", "message", "error"]),
  resultPaths: Object.freeze([
    "data[].url",
    "data.url",
    "result.images[].url",
    "result.image_url",
    "result.imageUrl",
    "results[].url",
    "results[].imageUrl",
    "image_url",
    "imageUrl",
    "url",
  ]),
});

const AGNES_IMAGE_TASK_POLLING = Object.freeze({
  mode: "task-proxy",
  method: "GET",
  urlTemplate: "{baseUrl}/v1/images/generations/{taskId}",
  headersMode: "raw",
});

const AGNES_IMAGE_MODELS = Object.freeze([
  Object.freeze({
    modelId: "agnes-image-2.0-flash",
    executionId: "agnes.model-api.image.agnes-image-2-flash.v1",
    displayName: "Agnes Image 2.0 Flash",
    model: "agnes/agnes-image-2.0-flash",
    description: "Agnes AI text-to-image and image-to-image model API",
    inputSlots: AGNES_IMAGE_INPUT_SLOTS,
    bodyMapping: AGNES_IMAGE_BODY_MAPPING,
    order: 10,
  }),
  Object.freeze({
    modelId: "agnes-image-2.1-flash",
    executionId: "agnes.model-api.image.agnes-image-2-1-flash.v1",
    displayName: "Agnes Image 2.1 Flash",
    model: "agnes/agnes-image-2.1-flash",
    description: "Agnes AI text-to-image and image-to-image model API",
    inputSlots: AGNES_IMAGE_INPUT_SLOTS,
    bodyMapping: AGNES_IMAGE_BODY_MAPPING,
    order: 20,
  }),
]);

export const agnesImageModelApiModelManifests = Object.freeze(
  AGNES_IMAGE_MODELS.map((modelConfig) =>
    createImageModelApiManifest({
      modelId: modelConfig.modelId,
      executionId: modelConfig.executionId,
      provider: "agnes",
      displayName: modelConfig.displayName,
      icon: "AG",
      description: modelConfig.description,
      fields: Object.freeze([
        APIMART_NANO_BANANA_IMAGE_SIZE_FIELD,
        APIMART_QWEN_IMAGE_RATIO_FIELD,
      ]),
      inputSlots: modelConfig.inputSlots,
      extensions: Object.freeze({
        imageMenu: Object.freeze({
          group: "agnes",
          order: modelConfig.order,
          title: modelConfig.displayName,
          subtitle: modelConfig.description,
          iconKind: "agnesBadge",
        }),
      }),
    }),
  ),
);

export const agnesImageModelApiExecutionManifests = Object.freeze(
  AGNES_IMAGE_MODELS.map((modelConfig) =>
    createModelApiExecutionManifest({
      id: modelConfig.executionId,
      provider: "agnes",
      model: modelConfig.model,
      endpoint: "/v1/images/generations",
      endpointMode: "image-generation",
      bodyMapping: modelConfig.bodyMapping,
      responseMapping: AGNES_IMAGE_RESPONSE_MAPPING,
      taskPolling: AGNES_IMAGE_TASK_POLLING,
      extensions: Object.freeze({
        bodyResolver: "agnesImage",
      }),
    }),
  ),
);
