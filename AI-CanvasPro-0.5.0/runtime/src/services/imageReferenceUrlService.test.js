import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGenerationInputImageUrl } from './imageReferenceUrlService.js';

test('resolveGenerationInputImageUrl reads direct URL fields from selected ai-image result item', () => {
  const cases = [
    ['imageUrl', 'https://cdn.example.com/item-image.png'],
    ['url', 'https://cdn.example.com/item-url.png'],
    ['resultUrl', 'https://cdn.example.com/item-result.png'],
  ];

  for (const [field, expected] of cases) {
    assert.equal(
      resolveGenerationInputImageUrl({
        type: 'ai-image',
        images: [{ [field]: expected }],
        mainImageIndex: 0,
      }),
      expected
    );
  }
});

test('resolveGenerationInputImageUrl keeps local ai-image result paths working', () => {
  assert.equal(
    resolveGenerationInputImageUrl({
      type: 'ai-image',
      images: [{ localPath: 'data/uploads/item.png' }],
      mainImageIndex: 0,
    }),
    '/data/uploads/item.png'
  );
});
