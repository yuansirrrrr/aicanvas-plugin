import {
  APIMART_NANO_BANANA_IMAGE_SIZE_FIELD,
  APIMART_QWEN_IMAGE_RATIO_FIELD,
  createImageModelApiManifest,
  createModelApiExecutionManifest,
} from './sharedImageModelApiFields.js';

const AGNES_IMAGE_INPUT_SLOTS = Object.freeze({
  allowedKinds: Object.freeze(['text', 'image']),
  minByKind: Object.freeze({ text: 0, image: 0 }),
  maxByKind: Object.freeze({ image: 8, video: 0, audio: 0 }),
});

const AGNES_IMAGE_BODY_MAPPING = Object.freeze([
  Object.freeze({ path: 'model', from: 'model' }),
  Object.freeze({ path: 'prompt', from: 'prompt' }),
  Object.freeze({
    path: 'size',
    from: 'param',
    field: Object.freeze(['generationParams.aspectRatio', 'resolvedRatioLabel', 'aspectRatio']),
    defaultValue: '4:3',
    transform: 'agnesImageSize',
  }),
  Object.freeze({
    path: 'extra_body.image',
    from: 'inputImages',
    omitWhenEmpty: true,
  }),
]);

const AGNES_IMAGE_RESPONSE_MAPPING = Object.freeze({
  statusPath: 'status',
  errorPath: Object.freeze(['error.message', 'message', 'error']),
  resultPaths: Object.freeze([
    'data[].url',
    'data.url',
    'results[].url',
    'results[].imageUrl',
    'url',
  ]),
});

const AGNES_IMAGE_MODELS = Object.freeze([
  Object.freeze({
    modelId: 'agnes/agnes-image-2.0-flash',
    executionId: 'agnes.model-api.image.agnes-image-2-flash.v1',
    displayName: 'Agnes Image 2.0 Flash',
    model: 'agnes-image-2.0-flash',
    description: 'Agnes AI text-to-image and image-to-image model API',
    inputSlots: AGNES_IMAGE_INPUT_SLOTS,
    bodyMapping: AGNES_IMAGE_BODY_MAPPING,
    order: 10,
  }),
  Object.freeze({
    modelId: 'agnes-image-2.1-flash',
    executionId: 'agnes.model-api.image.agnes-image-2-1-flash.v1',
    displayName: 'Agnes Image 2.1 Flash',
    model: 'agnes-image-2.1-flash',
    description: 'Agnes AI text-to-image and image-to-image model API',
    inputSlots: AGNES_IMAGE_INPUT_SLOTS,
    bodyMapping: AGNES_IMAGE_BODY_MAPPING,
    order: 20,
  }),
]);

export const agnesImageModelApiModelManifests = Object.freeze(
  AGNES_IMAGE_MODELS.map((modelDef) => createImageModelApiManifest({
    modelId: modelDef.modelId,
    executionId: modelDef.executionId,
    provider: 'agnes',
    displayName: modelDef.displayName,
    icon: 'AG',
    description: modelDef.description,
    fields: Object.freeze([
      APIMART_NANO_BANANA_IMAGE_SIZE_FIELD,
      APIMART_QWEN_IMAGE_RATIO_FIELD,
    ]),
    inputSlots: modelDef.inputSlots,
    extensions: Object.freeze({
      imageMenu: Object.freeze({
        group: 'agnes',
        order: modelDef.order,
        title: modelDef.displayName,
        subtitle: modelDef.description,
        iconKind: 'agnesBadge',
      }),
    }),
  })),
);

export const agnesImageModelApiExecutionManifests = Object.freeze(
  AGNES_IMAGE_MODELS.map((modelDef) => createModelApiExecutionManifest({
    id: modelDef.executionId,
    provider: 'agnes',
    model: modelDef.model,
    endpoint: '/v1/images/generations',
    endpointMode: 'image-generation',
    bodyMapping: modelDef.bodyMapping,
    responseMapping: AGNES_IMAGE_RESPONSE_MAPPING,
    extensions: Object.freeze({
      bodyResolver: 'agnesImage',
    }),
  })),
);
