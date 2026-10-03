import { assertMatch, assertEquals } from 'jsr:@std/assert@1';
import { buildPublicCode } from './public-code.ts';

Deno.test('buildPublicCode formats exact public code', () => {
  assertEquals(buildPublicCode(new Date('2026-10-03T12:00:00Z'), 'a1b2c'), 'BC-20261003-A1B2C');
  assertMatch(buildPublicCode(new Date('2026-10-03T12:00:00Z')), /^BC-20261003-[A-Z0-9]{5}$/);
});
