import test from "node:test";
import assert from "node:assert/strict";

import { buildGenerateVideoRequest } from "./aiVideoApi.js";
import { clearApiConfig } from "./configApi.js";

function makeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("buildGenerateVideoRequest should pass DeepRouterAI Veo 3.1 reference image and video URLs through", async () => {
  clearApiConfig();
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];

  try {
    globalThis.fetch = async (url) => {
      const href = String(url);
      fetchCalls.push(href);
      if (href === "/api/config") {
        return makeJsonResponse({
          providers: {
            deeprouterai: {
              apiUrl: "https://www.deeprouterai.com",
              apiKey: "k_deeprouter",
            },
          },
        });
      }
      throw new Error(`unexpected fetch url: ${href}`);
    };

    const request = await buildGenerateVideoRequest({
      provider: "deeprouterai",
      model: "deeprouterai/veo-3.1-generate-preview",
      prompt: "a cat surfing through neon waves",
      images: ["https://cdn.example.com/ref.png"],
      videos: ["https://cdn.example.com/ref.mp4"],
      generationParams: {
        duration: 6,
        aspectRatio: "9:16",
        resolution: "1080p",
      },
    });

    assert.equal(request.url, "/api/v2/proxy/image");
    assert.equal(request.body.apiUrl, "https://www.deeprouterai.com/v1/video/generations");
    assert.equal(request.body.model, "veo-3.1-generate-preview");
    assert.equal(request.body.prompt, "a cat surfing through neon waves");
    assert.equal(request.body.image, "https://cdn.example.com/ref.png");
    assert.deepEqual(request.body.image_urls, ["https://cdn.example.com/ref.png"]);
    assert.deepEqual(request.body.video_urls, ["https://cdn.example.com/ref.mp4"]);
    assert.deepEqual(request.body.metadata.image_urls, ["https://cdn.example.com/ref.png"]);
    assert.deepEqual(request.body.metadata.video_urls, ["https://cdn.example.com/ref.mp4"]);
    assert.equal(request.body.metadata.durationSeconds, 6);
    assert.equal(request.body.metadata.aspectRatio, "9:16");
    assert.equal(request.body.metadata.resolution, "1080p");
    assert.deepEqual(fetchCalls, ["/api/config"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildGenerateVideoRequest should reject local DeepRouterAI reference videos instead of uploading to RunningHub", async () => {
  clearApiConfig();
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href === "/api/config") {
        return makeJsonResponse({
          providers: {
            deeprouterai: {
              apiUrl: "https://www.deeprouterai.com",
              apiKey: "k_deeprouter",
            },
          },
        });
      }
      throw new Error(`unexpected fetch url: ${href}`);
    };

    await assert.rejects(
      () =>
        buildGenerateVideoRequest({
          provider: "deeprouterai",
          model: "deeprouterai/veo-3.1-generate-preview",
          prompt: "extend the reference video",
          videos: ["/local/ref.mp4"],
        }),
      /DeepRouterAI reference video requires a public URL/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
