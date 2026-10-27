import assert from 'node:assert/strict';
import test from 'node:test';
import { compensateUploadedObjects } from '../src/lib/storage-compensation';

test('storage compensation skips empty requests', async () => {
  let calls = 0;
  const result = await compensateUploadedObjects([], async () => {
    calls += 1;
    return {};
  });

  assert.equal(result, true);
  assert.equal(calls, 0);
});

test('storage compensation removes only owned uploaded paths', async () => {
  const owned = ['qa-run/a.png', 'qa-run/b.png'];
  let received: string[] = [];
  const result = await compensateUploadedObjects(owned, async (paths) => {
    received = paths;
    return {};
  });

  assert.equal(result, true);
  assert.deepEqual(received, owned);
  assert.notEqual(received, owned);
});

test('storage compensation reports failed cleanup without throwing', async () => {
  assert.equal(await compensateUploadedObjects(['qa-run/a.png'], async () => ({ error: new Error('synthetic') })), false);
  assert.equal(await compensateUploadedObjects(['qa-run/a.png'], async () => { throw new Error('synthetic'); }), false);
});
