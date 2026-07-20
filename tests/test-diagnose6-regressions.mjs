import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const play = fs.readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
const tvSw = fs.readFileSync(new URL('../public/tv/sw.js', import.meta.url), 'utf8');

assert.match(worker, /const BUILD = "1\.4\.18-diagnose(?:[6-9]|10)"/);
assert.match(play, /--card-gap:14px/);
assert.match(play, /\.card\{margin-bottom:var\(--card-gap\)/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose(?:[6-9]|10)/);
console.log('Diagnose 6+: Cloudflare-Build und einheitlicher Browser-Kartenabstand bestanden');
