import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTransport(pathname, origin = 'https://hitr.example') {
  const source = fs.readFileSync(pathname, 'utf8');
  const calls = [];
  const window = {
    location: { origin, href: `${origin}/play/`, replace() {} },
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController,
    HitsterRealtimeProtocol: { VERSION: 1 },
    WebSocket: class {},
    fetch: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200, json: async () => ({ clientUrl: 'http://192.168.1.42:8766/client/', tvUrl: 'http://192.168.1.42:8766/tv/' }) };
    }
  };
  window.window = window;
  const context = vm.createContext(window);
  vm.runInContext(source, context, { filename: pathname });
  return { Transport: context.CloudFirstRealtimeTransport, calls };
}

for (const rel of ['../public/play/realtime-websocket-transport.js', '../public/tv/realtime-websocket-transport.js']) {
  const pathname = new URL(rel, import.meta.url).pathname;
  const { Transport, calls } = loadTransport(pathname);
  const role = rel.includes('/tv/') ? 'tv' : 'player';
  const descriptor = {
    sessionId: 'session-1234567890abcdef',
    role,
    inviteToken: 'invite-1234567890abcdef',
    cloudBaseUrl: 'https://hitr.example',
    localCandidates: ['http://192.168.1.42:8766']
  };
  const transport = new Transport(descriptor, { role });
  assert.equal(typeof transport.diagnostic, 'function');
  assert.equal(typeof transport.getDiagnostics, 'function');
  assert.equal(typeof transport.probeCandidate, 'function');
  const target = await transport.probeCandidate('http://192.168.1.42:8766', 1000);
  assert.equal(target, role === 'tv' ? 'http://192.168.1.42:8766/tv/' : 'http://192.168.1.42:8766/client/');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/realtime\/bootstrap\?sid=/);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.mode, 'cors');
  assert.equal(calls[0].options.targetAddressSpace, 'local');
  assert.ok(transport.getDiagnostics().some(entry => entry.stage === 'local_probe_success'));
}

const client = fs.readFileSync(new URL('../public/play/index.html', import.meta.url), 'utf8');
const tv = fs.readFileSync(new URL('../public/tv/index.html', import.meta.url), 'utf8');
const tvJs = fs.readFileSync(new URL('../public/tv/tv.js', import.meta.url), 'utf8');
assert.match(client, /Verbindungsdiagnose/);
assert.match(client, /submitted:true,empty:!hasAnswer\(\)/);
assert.match(tv, /Verbindungsdiagnose/);
assert.doesNotMatch(tv, /id="room"/);
assert.match(tvJs, /playbackUntil/);
console.log('1.4.18-diagnose1 Diagnose-, Leerantwort- und TV-Vertrag bestanden');
