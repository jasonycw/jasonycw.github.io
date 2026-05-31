import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NETWORK_STATES,
  createDeterministicManualAdapter,
  decodeManualCode,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const host = createDeterministicManualAdapter({ sessionId: 'test-session' });
const offerCode = await host.createOffer({ playerName: 'Host' });
assert.equal(typeof offerCode, 'string');
assert.equal(offerCode.length > 0, true);
assert.equal(host.getState(), NETWORK_STATES.OFFER_READY);
assert.equal(decodeManualCode(offerCode, 'offer').ok, true);

const joiner = createDeterministicManualAdapter();
const answerResult = await joiner.createAnswer(offerCode, { playerName: 'Joiner' });
assert.equal(answerResult.ok, true);
assert.equal(answerResult.value.length > 0, true);
assert.equal(joiner.getState(), NETWORK_STATES.ANSWER_READY);
assert.equal(decodeManualCode(answerResult.value, 'answer').ok, true);

const acceptResult = await host.acceptAnswer(answerResult.value);
assert.equal(acceptResult.ok, true);
assert.equal(host.getState(), NETWORK_STATES.CONNECTED);

writeFileSync(path.join(evidenceDir, 'task-22-manual-connect.txt'), [
  'T22 manual WebRTC adapter evidence',
  `Offer code non-empty: ${offerCode.length > 0}`,
  `Answer code non-empty: ${answerResult.value.length > 0}`,
  `Host state after accept: ${host.getState()}`,
  'Adapter: deterministic local manual-code adapter for Node tests',
].join('\n'));

const retryJoiner = createDeterministicManualAdapter();
const invalidResult = await retryJoiner.createAnswer('not-a-valid-offer', { playerName: 'Joiner' });
assert.equal(invalidResult.ok, false);
assert.equal(retryJoiner.getState(), NETWORK_STATES.ERROR);

const retryResult = await retryJoiner.createAnswer(offerCode, { playerName: 'Joiner' });
assert.equal(retryResult.ok, true);
assert.equal(retryResult.value.length > 0, true);
assert.equal(retryJoiner.getState(), NETWORK_STATES.ANSWER_READY);

writeFileSync(path.join(evidenceDir, 'task-22-invalid-code.txt'), [
  'T22 invalid manual-code evidence',
  `Invalid code: not-a-valid-offer`,
  `Error shown by helper: ${invalidResult.errors[0]}`,
  `Retry answer code non-empty: ${retryResult.value.length > 0}`,
  `Retry state: ${retryJoiner.getState()}`,
].join('\n'));
