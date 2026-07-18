import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTransport(relativePath, role) {
  const filename = relativePath instanceof URL ? relativePath.pathname : String(relativePath);
  let replaced = '';
  const descriptor = {
    v: 1,
    sessionId: 'session-1234567890abcdef',
    role,
    inviteToken: 'invite-1234567890abcdef',
    roomCode: '7762W',
    localCandidates: ['http://127.0.0.1:8766', 'http://192.168.1.7:8766'],
    cloudBaseUrl: 'https://hitr.rdoe.workers.dev',
    expiresAt: 1777777777777
  };
  const window = {
    location: {
      href: 'https://hitr.rdoe.workers.dev/play/',
      origin: 'https://hitr.rdoe.workers.dev',
      replace(value) { replaced = String(value); }
    },
    HitsterRealtimeProtocol: { VERSION: 1 },
    HitsterRealtimeHandoff: () => ({
      participantId: 'player-1', resumeToken: 'resume-1', lastSequence: 8, displayName: 'Hans'
    }),
    URL, URLSearchParams, setTimeout, clearTimeout, WebSocket: class {}
  };
  window.window = window;
  const context = vm.createContext(window);
  vm.runInContext(fs.readFileSync(relativePath, 'utf8'), context, { filename });
  const transport = new context.CloudFirstRealtimeTransport(descriptor, { role });
  transport.navigateToLocalTarget(role === 'tv' ? 'http://127.0.0.1:8766/tv/' : 'http://127.0.0.1:8766/client/', true);
  assert.ok(replaced, 'Lokale Navigation wurde nicht ausgelöst');
  const target = new URL(replaced);
  const params = new URLSearchParams(target.hash.slice(1));
  assert.equal(params.get('sid'), descriptor.sessionId);
  assert.equal(params.get('role'), role);
  assert.equal(params.get('invite'), descriptor.inviteToken);
  assert.equal(params.get('code'), descriptor.roomCode);
  assert.equal(params.get('cloud'), descriptor.cloudBaseUrl);
  assert.equal(params.get('exp'), String(descriptor.expiresAt));
  assert.equal(params.get('name'), 'Hans');
  assert.equal(params.get('pid'), 'player-1');
  assert.equal(params.get('resume'), 'resume-1');
  assert.equal(params.get('seq'), '8');
  assert.equal(params.get('via'), 'local');
  assert.deepEqual(params.getAll('local'), descriptor.localCandidates);
}

loadTransport(new URL('../public/play/realtime-websocket-transport.js', import.meta.url), 'player');
loadTransport(new URL('../public/tv/realtime-websocket-transport.js', import.meta.url), 'tv');
console.log('Lokale Descriptor-Uebergabe fuer Spieler und TV bestanden');
