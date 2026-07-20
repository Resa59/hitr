import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const deploy = fs.readFileSync(new URL('../termux-deploy.sh', import.meta.url), 'utf8');
const phoneAudio = fs.readFileSync(new URL('../public/phone-audio/index.html', import.meta.url), 'utf8');
const player = fs.readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
const tvJs = fs.readFileSync(new URL('../public/tv/tv.js', import.meta.url), 'utf8');
const tvCss = fs.readFileSync(new URL('../public/tv/tv.css', import.meta.url), 'utf8');
const tvSw = fs.readFileSync(new URL('../public/tv/sw.js', import.meta.url), 'utf8');

assert.match(worker, /const BUILD = "1\.4\.18-diagnose8"/);
assert.equal(packageJson.version, '1.4.18-diagnose8');
assert.match(deploy, /EXPECTED_BUILD="1\.4\.18-diagnose8"/);
assert.match(phoneAudio, /Hitster Handy/);
assert.match(phoneAudio, /https:\/\/sdk\.scdn\.co\/spotify-player\.js/);
assert.match(phoneAudio, /enableMediaSession:true/);
assert.match(phoneAudio, /authentication_error/);
assert.match(phoneAudio, /TOKEN_REQUEST/);
assert.doesNotMatch(phoneAudio, /localStorage|sessionStorage/);
assert.match(player, /id="playerFullscreen"/);
assert.match(player, /requestPlayerFullscreen\(\)/);
assert.match(tvJs, /pairWithFullscreen/);
assert.match(tvCss, /zwei exakt gegenüberliegende Reflexionskeile/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose8/);
console.log('OK: Diagnose 8 sicherer Handyplayer, Vollbild und TV-Reflexionen bestanden.');
