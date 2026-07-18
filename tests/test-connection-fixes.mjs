import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTransport(pathname, origin='https://hitr.example') {
  const source=fs.readFileSync(pathname,'utf8');
  const window={
    location:{origin,href:`${origin}/play/`,replace(){}},
    URL,URLSearchParams,setTimeout,clearTimeout,
    HitsterRealtimeProtocol:{VERSION:1},
    WebSocket:class {}
  };
  window.window=window;
  const context=vm.createContext(window);
  vm.runInContext(source,context,{filename:pathname});
  return {context, Transport:context.CloudFirstRealtimeTransport};
}

for (const rel of ['../public/play/realtime-websocket-transport.js','../public/tv/realtime-websocket-transport.js']) {
  const pathname=new URL(rel,import.meta.url).pathname;
  const {Transport}=loadTransport(pathname);
  const descriptor={
    sessionId:'session-1234567890abcdef',role:rel.includes('/tv/')?'tv':'player',
    inviteToken:'invite-1234567890abcdef',cloudBaseUrl:'https://hitr.example',
    localCandidates:['http://127.0.0.1:8766','http://192.168.1.42:8766']
  };
  const transport=new Transport(descriptor,{role:descriptor.role});
  assert.deepEqual(Array.from(transport.orderedCandidates()),['http://192.168.1.42:8766','http://127.0.0.1:8766']);
  assert.equal(typeof transport.retryLocal,'function');
  assert.equal(typeof transport.localSwitchAllowed,'function');
  assert.equal(transport.directTarget('http://192.168.1.42:8766'),descriptor.role==='tv'?'http://192.168.1.42:8766/tv/':'http://192.168.1.42:8766/client/');
}


// Wenn ein lokaler WebSocket abbricht, muss derselbe Transport ohne äußere
// Reconnect-Schleife direkt zur Cloud wechseln.
{
  const pathname=new URL('../public/play/realtime-websocket-transport.js',import.meta.url).pathname;
  const {Transport}=loadTransport(pathname);
  const descriptor={sessionId:'session-1234567890abcdef',role:'player',inviteToken:'invite-1234567890abcdef',cloudBaseUrl:'https://hitr.example',localCandidates:['http://192.168.1.42:8766']};
  const transport=new Transport(descriptor,{role:'player'});
  let opened='', closed=0, phase='';
  transport.active='local';
  transport.links.local={open:false};
  transport.openLink=async(name,url)=>{opened=`${name}|${url}`;transport.active=name;};
  transport.onClose=()=>{closed++;};
  transport.onTransport=(name,value)=>{phase=`${name}|${value}`;};
  await transport.linkClosed('local',{code:1006,reason:'wifi lost'});
  assert.match(opened,/^cloud\|wss:\/\/hitr\.example\/api\/realtime\/ws/);
  assert.equal(closed,0);
  assert.equal(phase,'cloud|fallback');
}

const client=fs.readFileSync(new URL('../public/play/index.html',import.meta.url),'utf8');
const tv=fs.readFileSync(new URL('../public/tv/index.html',import.meta.url),'utf8');
const tvJs=fs.readFileSync(new URL('../public/tv/tv.js',import.meta.url),'utf8');
assert.match(client,/Direkt im WLAN versuchen/);
assert.match(client,/removedNotice/);
assert.match(client,/submitAnswer" class="primary answer-submit"/);
assert.match(tv,/Ein Spieler-Raumcode ist hier nicht erforderlich/);
assert.doesNotMatch(tv,/id="room"/);
assert.match(tv,/id="retryLocal"/);
assert.match(tvJs,/location\.replace\(`\/pair\.html\?new=\$\{Date\.now\(\)\}`\)/);

console.log('1.4.18 lokaler Transport-Retry, Kick-Hinweis und TV-Pairing-Vertrag bestanden');
