import assert from 'node:assert/strict';
import test from 'node:test';
import { privateJson } from '../src/lib/api-response';

test('privateJson forces private no-store over caller cache directives', async () => {
  const response = privateJson(
    { data: ['synthetic'] },
    { status: 403, headers: { 'Cache-Control': 'public, max-age=3600' } },
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { data: ['synthetic'] });
});
