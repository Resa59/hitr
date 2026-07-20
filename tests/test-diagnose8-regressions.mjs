import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const worker = read('src', 'worker.js');
const phoneHtml = read('public', 'phone-audio', 'index.html');
const phoneJs = read('public', 'phone-audio', 'phone-audio.js');
const playHtml = read('public', 'play', 'index.html');
const tvCss = read('public', 'tv', 'tv.css');

assert.match(worker, /const BUILD = ["']1\.4\.18-diagnose8["']/);
assert.match(phoneHtml, /phone-audio\.js/);
assert.match(phoneJs, /new\s+Spotify\.Player/);
assert.match(phoneJs, /enableMediaSession\s*:\s*true/);
assert.match(phoneJs, /token-request/);
assert.match(phoneJs, /ready/);
assert.match(playHtml, /id=["']playerFullscreen["']/);
assert.match(playHtml, /requestFullscreen/);
assert.match(tvCss, /conic-gradient/);

console.log('diagnose8 cloud regressions: ok');
