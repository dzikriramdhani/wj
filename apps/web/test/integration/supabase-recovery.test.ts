import test from 'node:test';

const enabled = Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_PUBLISHABLE_KEY);

test('Supabase recovery tokens are verified only in an isolated test project', { skip: !enabled }, async () => {
  // This intentionally requires an isolated Supabase test project and a test
  // mailbox. It must never run against Production or send a real email.
  throw new Error('Configure the isolated Supabase test harness before enabling this test.');
});
