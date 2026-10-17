import test from 'node:test';
import assert from 'node:assert/strict';
import * as media from '../../protocolos/protocolos.js';

const items = ['botox', 'bioestimulador', 'black-peel'].map((id) => ({
  src: `../assets/procedimentos/${id}.mp4`, poster: `${id}.webp`, title: id,
}));

class Video extends EventTarget {
  paused = true;
  ended = false;
  muted = false;
  volume = 0.6;
  plays = 0;
  loads = 0;
  attributes = {};
  pause() { this.paused = true; }
  load() { this.loads++; this.ended = false; }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  setAttribute(key, value) { this.attributes[key] = value; }
}

function setup(overrides = {}) {
  assert.equal(typeof media.createProtocolPlaylist, 'function', 'playlist controller is missing');
  const video = new Video();
  const changes = [], messages = [];
  const playlist = media.createProtocolPlaylist({ video, items,
    onChange: (index) => changes.push(index), onStatus: (message) => messages.push(message),
    ...overrides });
  return { video, playlist, changes, messages };
}

test('playlist starts with one selected source and waits for the visitor to play', () => {
  const { video, playlist, changes } = setup();
  assert.equal(video.src, items[0].src);
  assert.equal(video.poster, items[0].poster);
  assert.equal(video.plays, 0);
  assert.equal(playlist.index, 0);
  assert.deepEqual(changes, [0]);
});

test('ending a video advances the same player and preserves the visitor audio settings', async () => {
  const { video, playlist, changes } = setup();
  await video.play();
  video.ended = true;
  video.paused = true;
  video.dispatchEvent(new Event('ended'));
  await Promise.resolve();
  assert.equal(playlist.index, 1);
  assert.equal(video.src, items[1].src);
  assert.equal(video.paused, false);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 0.6);
  assert.deepEqual(changes, [0, 1]);
});

test('manual navigation preserves a paused player and continues one that is playing', async () => {
  const { video, playlist } = setup();
  playlist.next();
  assert.equal(video.plays, 0);
  await video.play();
  playlist.next();
  assert.equal(playlist.index, 2);
  assert.equal(video.plays, 2);
  video.pause();
  playlist.previous();
  assert.equal(playlist.index, 1);
  assert.equal(video.plays, 2);
});

test('the last video ends the sequence without starting an endless loop', () => {
  const { video, playlist, messages } = setup();
  playlist.select(2);
  video.ended = true;
  video.dispatchEvent(new Event('ended'));
  assert.equal(playlist.index, 2);
  assert.match(messages.at(-1), /concluída/i);
  assert.equal(video.plays, 0);
});

test('navigation outside the playlist cannot replace the current source', () => {
  const { video, playlist } = setup();
  for (const index of [-1, 3, NaN, 0.5]) assert.equal(playlist.select(index), false);
  assert.equal(video.src, items[0].src);
});

test('a browser playback restriction leaves usable controls and explains how to continue', async () => {
  const { video, playlist, messages } = setup();
  video.play = () => Promise.reject(new Error('NotAllowedError'));
  playlist.select(1, { autoplay: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(playlist.index, 1);
  assert.match(messages.at(-1), /reproduzir/i);
});

test('a rejected old playback request does not overwrite the status of a new selection', async () => {
  const { video, playlist, messages } = setup();
  let rejectOld;
  video.play = () => new Promise((resolve, reject) => { rejectOld = reject; });
  playlist.select(1, { autoplay: true });
  playlist.select(2, { autoplay: false });
  rejectOld(new Error('interrupted'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(playlist.index, 2);
  assert.equal(messages.at(-1), '');
});

test('a missing media file produces a recoverable message instead of an automatic skip loop', () => {
  const { video, playlist, messages } = setup();
  video.dispatchEvent(new Event('error'));
  assert.equal(playlist.index, 0);
  assert.match(messages.at(-1), /outro vídeo/i);
  playlist.next();
  assert.equal(playlist.index, 1);
  assert.equal(messages.at(-1), '');
});

test('destroying a playlist removes its media event handlers', () => {
  const { video, playlist } = setup();
  playlist.destroy();
  video.dispatchEvent(new Event('ended'));
  assert.equal(playlist.index, 0);
});

test('the page binds thumbnails, navigation, accessible selection and background pausing to the same video', async () => {
  class Element extends EventTarget {
    constructor(dataset = {}) { super(); this.dataset = dataset; this.attributes = {}; this.textContent = ''; this.hidden = true; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    getAttribute(key) { return this.attributes[key]; }
  }
  const video = new Video();
  const links = items.map((item) => {
    const link = new Element(item);
    link.attributes.href = item.src;
    return link;
  });
  const title = new Element(), description = new Element(), count = new Element();
  const status = new Element(), previous = new Element(), next = new Element();
  const controls = new Element();
  const fields = { video, '[data-video-title]': title, '[data-video-description]': description,
    '[data-video-count]': count, '[data-video-status]': status,
    '[data-video-previous]': previous, '[data-video-next]': next };
  const player = new Element();
  player.querySelector = (selector) => fields[selector];
  player.querySelectorAll = (selector) => selector === '[data-playlist-control]' ? [controls] : links;
  const root = new Element();
  root.querySelector = () => player;
  media.initProtocolVideos(root);
  media.initProtocolVideos(root);
  assert.equal(video.loads, 1, 'initialization must be idempotent');
  assert.equal(count.textContent, '1 de 3');
  assert.equal(previous.disabled, true);
  assert.equal(controls.hidden, false);
  assert.equal(links[0].attributes['aria-current'], 'true');
  links[1].dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(video.src, items[1].src);
  assert.equal(title.textContent, items[1].title);
  assert.equal(links[0].attributes['aria-current'], undefined);
  assert.equal(links[1].attributes['aria-current'], 'true');
  await video.play();
  next.dispatchEvent(new Event('click'));
  assert.equal(video.src, items[2].src);
  assert.equal(next.disabled, true);
  root.hidden = true;
  root.dispatchEvent(new Event('visibilitychange'));
  assert.equal(video.paused, true);
  previous.dispatchEvent(new Event('click'));
  assert.equal(video.src, items[1].src);
  assert.equal(video.paused, true);
});
