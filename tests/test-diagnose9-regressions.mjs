import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const worker = read("../src/worker.js");
const phone = read("../public/phone/index.html");
const phoneHost = read("../public/phone/spotify-phone-host.js");
const player = read("../public/play/index.html");
const tv = read("../public/tv/index.html");
const tvJs = read("../public/tv/tv.js");
const tvCss = read("../public/tv/tv.css");
const tvSw = read("../public/tv/sw.js");

assert.match(worker, /const BUILD = "1\.4\.18-diagnose(?:9|10)"/);
assert.match(phone, /spotify-phone-host\.js/);
assert.match(phoneHost, /enableMediaSession: true/);
assert.match(phoneHost, /PHONE_TOKEN_REQUEST/);
assert.match(phoneHost, /PHONE_PLAYER_READY/);
assert.doesNotMatch(phoneHost, /setInterval\s*\(/);
assert.match(player, /id="playerFullscreen"/);
assert.match(player, /requestFullscreen/);
assert.doesNotMatch(tv, /id="tvAudioButton"/);
assert.match(tvJs, /tryEnterFullscreen/);
assert.match(tvCss, /tv-reflection-pulse/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose(?:9|10)/);
console.log("1.4.18-diagnose10: HTTPS-Handyplayer, Vollbild, TV-Autostart und sichtbare Plattenreflexionen bestanden");
