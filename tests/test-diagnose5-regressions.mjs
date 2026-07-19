import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const client = fs.readFileSync(new URL('public/play/index.html', root), 'utf8');
const transport = fs.readFileSync(new URL('public/play/realtime-websocket-transport.js', root), 'utf8');
const worker = fs.readFileSync(new URL('src/worker.js', root), 'utf8');

assert.doesNotMatch(client, /id="retryLocal"|Direkt im WLAN versuchen/,
  'Transportwahl darf nicht als normale Nutzeraktion erscheinen');
assert.doesNotMatch(client, /updateLocalRetry|manual_local_retry/,
  'Entfernte manuelle Lokalwahl darf nicht mehr referenziert werden');
assert.match(client, /setConnection\(connected,connected\?"Verbunden"/,
  'Normale Oberfläche zeigt nur den verständlichen Verbindungsstatus');
assert.match(transport, /const backoff = \[30000, 60000, 120000, 300000, 600000\]/,
  'Lokale Wiederholungsversuche müssen gestaffelt sein');
assert.match(transport, /localProbeFailures \+= 1/,
  'Fehlschläge müssen den lokalen Backoff erhöhen');
assert.match(transport, /localProbeFailures = 0/,
  'Kandidatenänderung oder erfolgreiche Verbindung muss den Backoff zurücksetzen');
assert.doesNotMatch(transport, /setInterval\(/,
  'Der Browsertransport darf kein periodisches Polling enthalten');
assert.match(worker, /1\.4\.18-diagnose5/,
  'Health-Build muss diagnose5 melden');

console.log('1.4.18-diagnose5: automatische Lokalwahl, Backoff und reduzierte Nutzeranzeige bestanden');
