import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTransport(relativePath, role) {
  const source=fs.readFileSync(relativePath,'utf8');
  let replaced='';
  const window={
    location:{href:'https://hitr.rdoe.workers.dev/play/',origin:'https://hitr.rdoe.workers.dev',protocol:'https:',replace(value){replaced=String(value)}},
    URL,URLSearchParams,setTimeout,clearTimeout,AbortController,
    fetch:async()=>{throw new Error('not used')},WebSocket:class {}
  };
  window.window=window;
  const context=vm.createContext(window);
  vm.runInContext(source,context,{filename:String(relativePath)});
  const descriptor={v:1,sessionId:'session-1234567890abcdef',role,inviteToken:'invite-1234567890abcdef',roomCode:'7762W',localCandidates:['http://127.0.0.1:8766','http://192.168.1.7:8766'],cloudBaseUrl:'https://hitr.rdoe.workers.dev'};
  const transport=new context.CloudFirstRealtimeTransport(descriptor,{role});
  assert.deepEqual(Array.from(transport.usableCandidates()),['http://192.168.1.7:8766'],'Loopback darf nicht an fremde Geräte gehen');
  assert.equal(typeof transport.navigateToLocalTarget,'undefined','Browser darf nicht mehr auf lokale Seite navigieren');
  assert.equal(replaced,'','Cloudseite muss erhalten bleiben');
  const state=transport.state();assert.equal(state.cloudConnected,false);assert.equal(state.localConnected,false);assert.equal(state.preferredDataPath,'cloud');assert.equal(state.active,'');
  transport.updateLocalCandidates(['http://127.0.0.1:8766','http://10.0.0.2:8766']);
  assert.deepEqual(Array.from(transport.usableCandidates()),['http://10.0.0.2:8766']);
}
loadTransport(new URL('../public/play/realtime-websocket-transport.js',import.meta.url),'player');
loadTransport(new URL('../public/tv/realtime-websocket-transport.js',import.meta.url),'tv');
console.log('Hybridtransport: Cloudseite bleibt bestehen und Loopback wird nicht veröffentlicht');
