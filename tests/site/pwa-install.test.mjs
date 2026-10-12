import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const scriptPath = new URL('../../pwa-install.js', import.meta.url);

function page({ standalone = false, iosStandalone = false } = {}) {
  const button = new EventTarget();
  Object.assign(button, { hidden: true, disabled: false });
  const status = { textContent: 'Siga as instruções do seu aparelho.' };
  const window = new EventTarget();
  window.matchMedia = () => ({ matches: standalone });
  const document = {
    getElementById: (id) => ({ installApp: button, installStatus: status })[id] || null,
  };
  // Missing implementation leaves the controls in their initial HTML state.
  const source = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : '';
  vm.runInNewContext(source, { window, document, navigator: { standalone: iosStandalone } });
  return { button, status, window };
}

function offer(window, prompt) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt;
  window.dispatchEvent(event);
  return event;
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

test('offers native installation only after the browser allows it and the user taps', async () => {
  const { button, window } = page();
  assert.equal(button.hidden, true);
  let calls = 0;
  const event = offer(window, async () => { calls++; return { outcome: 'accepted' }; });
  assert.equal(event.defaultPrevented, true);
  assert.equal(button.hidden, false);
  assert.equal(calls, 0);
  button.dispatchEvent(new Event('click'));
  await settled();
  assert.equal(calls, 1);
  assert.equal(button.hidden, true);
  button.dispatchEvent(new Event('click'));
  assert.equal(calls, 1, 'a one-use browser prompt must not be reused');
});

test('dismissal keeps manual instructions usable without claiming installation', async () => {
  const { button, status, window } = page();
  offer(window, async () => ({ outcome: 'dismissed' }));
  button.dispatchEvent(new Event('click'));
  await settled();
  assert.match(status.textContent, /cancelada/i);
  assert.equal(button.hidden, true);
  offer(window, async () => ({ outcome: 'accepted' }));
  assert.equal(button.hidden, false, 'a fresh browser offer can be used again');
});

test('a rejected browser prompt falls back to manual installation', async () => {
  const { button, status, window } = page();
  offer(window, async () => { throw new Error('browser unavailable'); });
  button.dispatchEvent(new Event('click'));
  await settled();
  assert.match(status.textContent, /não foi possível/i);
  assert.match(status.textContent, /instruções/i);
  assert.equal(button.hidden, true);
  assert.equal(button.disabled, false);
});

test('installation completion wins over a still-pending prompt result', async () => {
  const { button, status, window } = page();
  let finish;
  offer(window, () => new Promise((resolve) => { finish = resolve; }));
  button.dispatchEvent(new Event('click'));
  assert.equal(typeof finish, 'function', 'the browser prompt should have started');
  window.dispatchEvent(new Event('appinstalled'));
  finish({ outcome: 'accepted' });
  await settled();
  assert.match(status.textContent, /instalado/i);
  assert.equal(button.hidden, true);
});

for (const mode of [{ standalone: true }, { iosStandalone: true }]) {
  test(`an already opened app does not offer installation: ${JSON.stringify(mode)}`, () => {
    const { button, status, window } = page(mode);
    assert.match(status.textContent, /já está/i);
    let calls = 0;
    offer(window, async () => { calls++; });
    button.dispatchEvent(new Event('click'));
    assert.equal(button.hidden, true);
    assert.equal(calls, 0);
  });
}
