import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const pair = fs.readFileSync(new URL('../public/pair.html', import.meta.url), 'utf8');
const root = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const tvCss = fs.readFileSync(new URL('../public/tv/tv.css', import.meta.url), 'utf8');
const tvAudio = fs.readFileSync(new URL('../public/tv/spotify-tv-audio.js', import.meta.url), 'utf8');
const tvSw = fs.readFileSync(new URL('../public/tv/sw.js', import.meta.url), 'utf8');

assert.match(worker, /const BUILD = "1\.4\.18-diagnose\d+"/);
assert.equal(pair, root, 'Root- und Pairing-Seite müssen denselben aktuellen TV-Pairing-Stand ausliefern');
assert.match(pair, /class="panel pair-panel"/);
assert.match(pair, /audio:"1"/);
assert.match(pair, /\/tv\/tv\.css/);
assert.match(tvCss, /\.pair-panel\{/);
assert.match(tvCss, /max-aspect-ratio:4\/3/);
assert.match(tvAudio, /onWelcome\(transport\)[\s\S]*startAutomatically\(false\)/);
assert.match(tvAudio, /enableMediaSession: true/);
assert.match(tvAudio, /READY_TIMEOUT_MS = 20000/);
assert.doesNotMatch(tvAudio, /TV-Ton jetzt aktivieren/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose\d+/);
console.log('OK: Diagnose 7 Pairing-Layout, automatisches TV-Spotify und Cloudflare-Build bestanden.');
