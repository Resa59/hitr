import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const packageInfo = JSON.parse(read("../package.json"));
const worker = read("../src/worker.js");
const wrangler = read("../wrangler.jsonc");
const assetlinks = JSON.parse(read("../public/.well-known/assetlinks.json"));
const player = read("../public/play/index.html");
const tvSw = read("../public/tv/sw.js");

assert.equal(packageInfo.version, "1.4.18-diagnose18");
assert.match(worker, /const BUILD = "1\.4\.18-diagnose18"/);
assert.match(worker, /"twa-dal-v2"/);
assert.match(worker, /"phone-multiplayer-v2"/);
assert.match(worker, /\/api\/twa\/diagnostics/);
assert.match(wrangler, /"\/\.well-known\/assetlinks\.json"/);
assert.equal(assetlinks.length, 1);
assert.deepEqual(new Set(assetlinks[0].relation), new Set([
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin",
]));
assert.equal(assetlinks[0].target.package_name, "de.resa.hitstertrainer");
assert.ok(assetlinks[0].target.sha256_cert_fingerprints.includes(
  "27:F6:22:E6:79:0D:91:66:5A:60:67:4B:8A:36:D1:72:2E:6C:77:7F:59:5A:ED:FF:1E:4A:35:92:23:83:A0:DC"
));
assert.match(player, /p\.active!==false/);
assert.match(player, /P\.TYPES\.LEAVE/);
assert.match(tvSw, /hitster-tv-v1\.4\.18-diagnose18/);
console.log("Diagnose 16: TWA-DAL, Serverdiagnose, Handy-Mehrspieler und erneuerter TV-Cache bestanden");
