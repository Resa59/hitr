import fs from 'node:fs';
import assert from 'node:assert/strict';
const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const player=fs.readFileSync(new URL('../public/play/realtime-websocket-transport.js',import.meta.url),'utf8');
const tv=fs.readFileSync(new URL('../public/tv/realtime-websocket-transport.js',import.meta.url),'utf8');
const tvAudio=fs.readFileSync(new URL('../public/tv/spotify-tv-audio.js',import.meta.url),'utf8');
assert(worker.includes('TV_AUDIO_TOKEN')&&worker.includes('HOST_TYPES'),'TV audio token allowlist');
assert(!worker.includes('message.type === "TV_AUDIO_TOKEN"'),'TV audio token must never be stored as snapshot');
assert(tvAudio.includes('Spotify.Player')&&tvAudio.includes('activateElement'),'Spotify Web Playback controller');
assert(tvAudio.includes('token-request')&&tvAudio.includes('TV_AUDIO_TOKEN'),'short-lived token handshake');
assert(tvAudio.includes('return !this.audioRequested && !this.connectedToSpotify'),'secure cloud path prevents local switch while TV audio is active');

assert(worker.includes('shortJoin')&&worker.includes('/play/?code='),'short player join route');
assert(worker.includes('tvAppLink')&&worker.includes('/open-app.html'),'TV HTTPS app-link route');
assert(worker.includes('/.well-known/assetlinks.json')&&worker.includes('sha256_cert_fingerprints'),'Android asset links');
assert(worker.includes('/p/${state.code}/${state.pairToken}'),'short TV app link generated');
for(const route of ['/api/realtime/session/open','/api/realtime/session/update','/api/realtime/session/end','/api/realtime/resolve','/api/realtime/ws','/api/realtime/pair/create','/api/realtime/pair/claim']) assert(worker.includes(route),route);
for(const klass of ['SessionRoom','RoomAlias','PairRoom']) { assert(worker.includes(`export class ${klass}`)); assert(wrangler.includes(`"class_name": "${klass}"`)); }
assert(worker.includes('acceptWebSocket(server)'),'hibernatable WebSockets');
assert(worker.includes('serializeAttachment'),'connection attachment');
assert(worker.includes('hostInviteToken')&&worker.includes('playerInviteToken')&&worker.includes('tvInviteToken'),'role tokens');
assert(worker.includes('PLAYER_TYPES')&&worker.includes('TV_TYPES')&&worker.includes('HOST_TYPES'),'message allowlists');
assert(worker.includes('target.participantId'),'private routing');
assert(!worker.includes('storage.put("playerSnapshot"')&&!worker.includes('storage.put("tvSnapshot"'),'game snapshots stay out of Durable Object storage');
assert(worker.includes('claim-qr|request-code|claim-status|state|heartbeat'),'legacy TV compatibility');

assert(worker.includes('/api/realtime/session/kick')&&worker.includes('url.pathname === "/kick"'),'host kick route');
assert(worker.includes('REMOVED')&&worker.includes('roster'),'persistent roster and removal');
assert(worker.includes('TRANSPORT_SELECTED')&&worker.includes('TRANSPORT_CONFIRMED'),'explicit transport selection');
assert(worker.includes('needsSnapshot: true'),'fresh snapshot request after cloud selection');
assert(worker.includes('7 * 24 * 3600000'),'renewable seven-day room lifetime');
assert(worker.includes('setAlarm(expiresAt)'),'session and alias expiry alarms');
for(const source of [player,tv]) {
  assert(source.includes('CloudFirstRealtimeTransport'));
  assert(source.includes('openLink("cloud"'));
  assert(source.includes('probeLocal(true)'));
  assert(source.includes('onCloudSelected'));
  assert(source.includes('location.replace'));
}
console.log('Cloudflare transport-selection persistent-room + Spotify TV audio contract 1.4.9 passed');
