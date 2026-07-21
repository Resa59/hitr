import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const packageInfo = JSON.parse(read("../package.json"));
const worker = read("../src/worker.js");
const player = read("../public/play/index.html");
const tv = read("../public/tv/tv.js");
const playerTransport = read("../public/play/realtime-websocket-transport.js");
const tvTransport = read("../public/tv/realtime-websocket-transport.js");
const tvSw = read("../public/tv/sw.js");
const assetlinks = JSON.parse(read("../public/.well-known/assetlinks.json"));

assert.equal(packageInfo.version, "1.4.18-diagnose18");
assert.match(worker, /const BUILD = "1\.4\.18-diagnose18"/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose18/);
assert.deepEqual(new Set(assetlinks[0].relation), new Set([
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin",
]));
assert.match(playerTransport, /targetAddressSpace\s*=\s*"local"/);
assert.match(playerTransport, /localPermissionState|lastLocalFailure|secureContext/);
assert.match(tvTransport, /targetAddressSpace\s*=\s*"local"/);
assert.match(tvTransport, /localPermissionState|lastLocalFailure|secureContext/);
assert.match(player, /localPermissionState|secureContext/);
assert.match(tv, /localPermissionState|secureContext/);
assert.match(tv, /Haupthandy nicht verbunden · Wiederverbindung läuft/);
console.log("Diagnose 17: Build, TWA-DAL, lokale Transportdiagnose und TV-Hoststatus bestanden");
