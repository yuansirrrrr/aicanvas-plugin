import test from 'node:test';
import assert from 'node:assert/strict';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Agnes image task resume prefixes default apiUrl for legacy relative polling template', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const seenTaskUrls = [];

  try {
    globalThis.window = { currentProjectId: 'proj-agnes-test', location: { href: 'http://localhost/' } };
    globalThis.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      if (requestUrl === '/api/config') {
        return jsonResponse({
          providers: {
            agnes: { apiUrl: '', apiKey: 'k_agnes' },
          },
        });
      }
      if (requestUrl.startsWith('/api/v2/proxy/task?')) {
        const apiUrl = new URL('http://local' + requestUrl).searchParams.get('apiUrl');
        seenTaskUrls.push(apiUrl);
        assert.equal(apiUrl, 'https://apihub.agnes-ai.com/v1/images/generations/task-agnes-ref-1');
        return jsonResponse({
          status: 'succeeded',
          data: [{ url: 'https://img.example.com/agnes-final.png' }],
        });
      }
      if (requestUrl === '/api/v2/save_output_from_url') {
        return jsonResponse({ path: 'output/agnes-final.png' });
      }
      throw new Error('unexpected fetch url: ' + requestUrl);
    };

    const { clearApiConfig } = await import('./configApi.js');
    const { resumeAsyncImageTask } = await import('./aiImageApi.js');
    clearApiConfig();

    const result = await resumeAsyncImageTask(
      'task-agnes-ref-1',
      { provider: 'agnes', model: 'agnes/agnes-image-2.1-flash' },
      {
        taskPolling: {
          provider: 'agnes',
          method: 'GET',
          mode: 'task-proxy',
          urlTemplate: '/v1/images/generations/{taskId}',
          headersMode: 'raw',
        },
        responseMapping: {
          resultPaths: ['data[].url'],
        },
      },
    );

    assert.equal(seenTaskUrls.length, 1);
    assert.equal(result.localPath, 'output/agnes-final.png');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('Agnes image generation treats task-like data url as async task id', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const seenTaskUrls = [];
  let submitCount = 0;
  let submittedBody = null;

  try {
    globalThis.window = { currentProjectId: 'proj-agnes-submit-test', location: { href: 'http://localhost/' } };
    globalThis.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      if (requestUrl === '/api/config') {
        return jsonResponse({
          providers: {
            agnes: { apiUrl: '', apiKey: 'k_agnes' },
          },
        });
      }
      if (requestUrl === 'https://uploaded.example/ref.png') {
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'Content-Type': 'image/png' },
        });
      }
      if (requestUrl.startsWith('/api/v2/proxy/upload')) {
        return jsonResponse({
          url: 'https://agnes-upload.example/ref.png',
          data: { url: 'https://agnes-upload.example/ref.png' },
        });
      }
      if (requestUrl === '/api/v2/proxy/image') {
        submitCount += 1;
        submittedBody = JSON.parse(options.body || '{}');
        return jsonResponse({
          status: 'processing',
          data: [{ url: 'task_agnes_img2img_1' }],
        });
      }
      if (requestUrl.startsWith('/api/v2/proxy/task?')) {
        const apiUrl = new URL('http://local' + requestUrl).searchParams.get('apiUrl');
        seenTaskUrls.push(apiUrl);
        assert.equal(apiUrl, 'https://apihub.agnes-ai.com/v1/images/generations/task_agnes_img2img_1');
        return jsonResponse({
          status: 'succeeded',
          data: [{ url: 'https://img.example.com/agnes-img2img-final.png' }],
        });
      }
      if (requestUrl === '/api/v2/save_output_from_url') {
        return jsonResponse({ path: 'output/agnes-img2img-final.png' });
      }
      throw new Error('unexpected fetch url: ' + requestUrl);
    };

    const { clearApiConfig } = await import('./configApi.js');
    const { generateImage } = await import('./aiImageApi.js');
    clearApiConfig();

    const result = await generateImage({
      provider: 'agnes',
      model: 'agnes/agnes-image-2.1-flash',
      prompt: 'turn the reference into a poster',
      inputUrls: ['https://uploaded.example/ref.png'],
    });

    assert.equal(submitCount, 1);
    assert.equal(submittedBody.model, 'agnes-image-2.1-flash');
    assert.equal(submittedBody.prompt, 'turn the reference into a poster');
    assert.equal(submittedBody.extra_body?.prompt, 'turn the reference into a poster');
    assert.deepEqual(submittedBody.extra_body?.image, ['https://agnes-upload.example/ref.png']);
    assert.equal(seenTaskUrls.length, 1);
    assert.equal(result.localPath, 'output/agnes-img2img-final.png');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('Agnes image generation sends provider model token without provider prefix', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let submittedBody = null;

  try {
    globalThis.window = { currentProjectId: 'proj-agnes-model-token-test', location: { href: 'http://localhost/' } };
    globalThis.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      if (requestUrl === '/api/config') {
        return jsonResponse({
          providers: {
            agnes: { apiUrl: '', apiKey: 'k_agnes' },
          },
        });
      }
      if (requestUrl === '/api/v2/proxy/image') {
        submittedBody = JSON.parse(options.body || '{}');
        return jsonResponse({
          status: 'succeeded',
          data: [{ url: 'https://img.example.com/agnes-text-final.png' }],
        });
      }
      if (requestUrl === '/api/v2/save_output_from_url') {
        return jsonResponse({ path: 'output/agnes-text-final.png' });
      }
      throw new Error('unexpected fetch url: ' + requestUrl);
    };

    const { clearApiConfig } = await import('./configApi.js');
    const { generateImage } = await import('./aiImageApi.js');
    clearApiConfig();

    const result = await generateImage({
      provider: 'agnes',
      model: 'agnes/agnes-image-2.0-flash',
      prompt: 'a clean product render',
      inputUrls: [],
    });

    assert.equal(submittedBody.model, 'agnes-image-2.0-flash');
    assert.equal(submittedBody.prompt, 'a clean product render');
    assert.equal(result.localPath, 'output/agnes-text-final.png');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('Agnes image generation does not poll final image url as task id', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let pollCount = 0;

  try {
    globalThis.window = { currentProjectId: 'proj-agnes-final-url-test', location: { href: 'http://localhost/' } };
    globalThis.fetch = async (url, options = {}) => {
      const requestUrl = String(url);
      if (requestUrl === '/api/config') {
        return jsonResponse({
          providers: {
            agnes: { apiUrl: '', apiKey: 'k_agnes' },
          },
        });
      }
      if (requestUrl === '/api/v2/proxy/image') {
        const submittedBody = JSON.parse(options.body || '{}');
        assert.equal(submittedBody.model, 'agnes-image-2.0-flash');
        assert.equal(submittedBody.prompt, 'a direct final url response');
        return jsonResponse({
          data: [{ url: 'https://platform-outputs.agnes-ai.space/images/t2i/final.png' }],
        });
      }
      if (requestUrl.startsWith('/api/v2/proxy/task?')) {
        pollCount += 1;
        throw new Error('should not poll final image url: ' + requestUrl);
      }
      if (requestUrl === '/api/v2/save_output_from_url') {
        return jsonResponse({ path: 'output/agnes-final-url.png' });
      }
      throw new Error('unexpected fetch url: ' + requestUrl);
    };

    const { clearApiConfig } = await import('./configApi.js');
    const { generateImage } = await import('./aiImageApi.js');
    clearApiConfig();

    const result = await generateImage({
      provider: 'agnes',
      model: 'agnes/agnes-image-2.0-flash',
      prompt: 'a direct final url response',
      inputUrls: [],
    });

    assert.equal(pollCount, 0);
    assert.equal(result.localPath, 'output/agnes-final-url.png');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
