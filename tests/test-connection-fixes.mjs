import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTransport(pathname,origin='https://hitr.example'){
  const source=fs.readFileSync(pathname,'utf8');
  const window={location:{origin,href:`${origin}/play/`,protocol:'https:'},URL,URLSearchParams,setTimeout,clearTimeout,AbortController,fetch:async()=>{throw new Error('offline')},WebSocket:class {}};
  window.window=window;const context=vm.createContext(window);vm.runInContext(source,context,{filename:pathname});return context.CloudFirstRealtimeTransport;
}
for(const rel of ['../public/play/realtime-websocket-transport.js','../public/tv/realtime-websocket-transport.js']){
  const pathname=new URL(rel,import.meta.url).pathname,Transport=loadTransport(pathname);
  const role=rel.includes('/tv/')?'tv':'player';
  const t=new Transport({sessionId:'session-1234567890abcdef',role,inviteToken:'invite-1234567890abcdef',cloudBaseUrl:'https://hitr.example',localCandidates:['http://127.0.0.1:8766','http://192.168.1.42:8766']},{role});
  assert.deepEqual(Array.from(t.usableCandidates()),['http://192.168.1.42:8766']);
  assert.equal(typeof t.retryLocal,'function');assert.equal(typeof t.sendVia,'function');
  t.cloudConnected=true;t.cloudConfirmed=true;t.links.cloud={open:true};t.localConnected=true;t.localConfirmed=true;t.links.local={open:true};t.updateActive();
  assert.equal(t.state().cloudConnected,true);assert.equal(t.state().localConnected,true);assert.equal(t.state().preferredDataPath,'local');
  t.links.local={open:false};await t.linkClosed('local',{code:1006,reason:'wifi lost'});
  assert.equal(t.state().cloudConnected,true,'Cloud-Steuerkanal muss beim lokalen Abbruch bestehen bleiben');
  assert.equal(t.state().preferredDataPath,'cloud');
}
const client=fs.readFileSync(new URL('../public/play/index.html',import.meta.url),'utf8');
const tv=fs.readFileSync(new URL('../public/tv/index.html',import.meta.url),'utf8');
const tvJs=fs.readFileSync(new URL('../public/tv/tv.js',import.meta.url),'utf8');
assert.match(client,/Cloud-Kontrollkanal/);assert.match(client,/Dieses Gerät/);assert.match(client,/copyClientDiagnostics/);
assert.match(tv,/Ein Spieler-Raumcode ist hier nicht erforderlich/);assert.doesNotMatch(tv,/id="room"/);assert.match(tv,/copyTvDiagnostics/);
assert.doesNotMatch(tvJs,/setInterval\([^\n]*4000/,'TV_READY darf Durable Object nicht alle vier Sekunden wecken');
assert.match(tvJs,/sendVia\("cloud"/,'TV-Steuerereignisse bleiben auf Cloud');
console.log('1.4.18-diagnose3: paralleler Cloud-/Lokalkanal, UI-Diagnose und sparsame TV-Bereitschaft bestanden');
process.exit(0);
