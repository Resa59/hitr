import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const clientPath = new URL('public/play/index.html', root).pathname;
const workerPath = new URL('src/worker.js', root).pathname;
const client = fs.readFileSync(clientPath, 'utf8');
const worker = fs.readFileSync(workerPath, 'utf8');

// 1) LAN-Kandidaten werden nur bei einer tatsächlichen Änderung gespeichert
// und über den bestehenden Cloud-Kontrollkanal verteilt. Wiederholungen desselben
// Zustands dürfen weder Storage-Schreibzugriffe noch Broadcasts auslösen.
{
  assert.match(worker, /const nextCandidates = Array\.isArray\(body\.localCandidates\)[\s\S]*?slice\(0, 8\)/,
    'Kandidaten müssen normalisiert, dedupliziert und begrenzt werden');
  assert.match(worker, /const descriptorChanged = JSON\.stringify\(d\.localCandidates \|\| \[\]\) !== JSON\.stringify\(nextCandidates\)/,
    'Eine echte Kandidatenänderung muss erkannt werden');
  assert.match(worker, /if \(descriptorChanged\) \{[\s\S]*?ctx\.storage\.put\("descriptor", d\)[\s\S]*?envelope\("LOCAL_CANDIDATES"/,
    'Storage und Broadcast dürfen nur bei echter Änderung erfolgen');
  assert.match(worker, /return json\(\{ ok: true, descriptorChanged, localCandidates:/,
    'Update-Endpunkt muss mitteilen, ob tatsächlich etwas geändert wurde');
}

// 2) Browser-Refresh: Nach Auflösung des Raumcodes müssen die für genau diese
// Session gespeicherte participantId und das Resume-Token vor connect() geladen
// werden. Der Worker ersetzt anschließend die alte Verbindung derselben ID.
{
  const joinMatch = client.match(/async function join\(\)\{([\s\S]*?)\}\nasync function connect/);
  assert.ok(joinMatch, 'join()-Funktion fehlt');
  const joinBody = joinMatch[1];
  const resolvePos = joinBody.indexOf('resolveByCode(room)');
  const restorePos = joinBody.indexOf('restorePersistedSession()');
  const connectPos = joinBody.indexOf('await connect()');
  assert.ok(resolvePos >= 0 && restorePos > resolvePos && connectPos > restorePos,
    'Gespeicherte Teilnehmeridentität muss nach Sessionauflösung und vor connect() geladen werden');
  assert.match(client, /sessionId:C\.descriptor\.sessionId,participantId:C\.participantId,resumeToken:C\.resumeToken/,
    'Session, Teilnehmer-ID und Resume-Token müssen gemeinsam gespeichert werden');
  assert.match(worker, /a\.participantId === participantId[\s\S]*?other\.close\(4001, "replaced"\)/,
    'Der Worker muss die alte Verbindung derselben Teilnehmer-ID ersetzen');
  assert.match(worker, /const online = new Set\(\), onlinePlayers = new Set\(\), onlineTv = new Set\(\)/,
    'Präsenzzählung muss Teilnehmer-IDs deduplizieren');
}

// 3) Nach Spielende muss die Browserseite den wartenden Master-Raum erkennen und
// die zuletzt übertragene Gesamtauswertung nach Refresh/Reconnect anzeigen können.
{
  assert.match(client, /if\(s\.phase==="room_idle"\)\{if\(s\.lastSummary\)\{renderSummary\(s\.lastSummary\)/,
    'Browser muss im wartenden Raum die letzte Gesamtauswertung darstellen');
  assert.match(worker, /snapshot: null/,
    'WELCOME enthält einen definierten Snapshot-Platzhalter');
}

console.log('1.4.18-diagnose4 Cloudflare-Paket: Kandidaten-Sparsamkeit, Refresh-Wiederaufnahme und Raumabschluss-Verträge bestanden');
