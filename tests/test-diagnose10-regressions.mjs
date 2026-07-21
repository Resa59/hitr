import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const worker = read("../src/worker.js");
const phoneHost = read("../public/phone/spotify-phone-host.js");
const tvTransport = read("../public/tv/realtime-websocket-transport.js");
const tvJs = read("../public/tv/tv.js");

assert.match(worker, /const BUILD = "1\.4\.18-diagnose1[0-3]"/);
assert.match(worker, /const CAPABILITIES = \[[^\n]*"inactivity-confirm-v1"/);
assert.match(worker, /const INACTIVITY_CONFIRM_GRACE_MS = 15 \* 1000/);
assert.match(worker, /envelope\("SESSION_ACTIVITY_CHECK"/);
assert.match(worker, /storage\.delete\("pendingInactivityCheck"\)/);
assert.match(phoneHost, /encryptedMediaApi/);
assert.match(phoneHost, /requestMediaKeySystemAccess/);
assert.match(tvTransport, /sendAll\(value\)/);
assert.match(tvJs, /typeof T\.transport\.sendAll==="function"\)T\.transport\.sendAll\(leave\)/);
const leaveIndex = worker.indexOf('if (message.type === "LEAVE")');
const selectedIndex = worker.indexOf('if (!a.selected && a.role !== "host")');
assert.ok(leaveIndex > 0 && selectedIndex > leaveIndex, "LEAVE muss vor der Nutzdaten-Transportauswahl verarbeitet werden");
assert.match(worker, /const ids = new Set\(Object\.values\(roster\)/);
assert.match(worker, /a\.authenticated/);
assert.doesNotMatch(phoneHost, /localStorage|sessionStorage/);
console.log("1.4.18-diagnose10+: Spotify-EME-Diagnose und robuster TV-Steuerkanal bestanden");
