import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const file=new URL('../src/worker.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
source=source
  .replace('import { DurableObject } from "cloudflare:workers";','class DurableObject { constructor(ctx, env) { this.ctx=ctx; this.env=env; } }')
  .replace('export default {','const workerDefault = {')
  .replaceAll('export class ','class ')
  .concat('\n;globalThis.__classes={SessionRoom,RoomAlias};');

const context={
  console, TextEncoder, TextDecoder, crypto:globalThis.crypto,
  btoa:value=>Buffer.from(value,'binary').toString('base64'),
  Response, Request, Headers, URL, WebSocketPair:class {},
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'worker.js'});
const {SessionRoom,RoomAlias}=context.__classes;

class Storage {
  constructor(initial={}){this.map=new Map(Object.entries(initial));this.alarms=[];this.putKeys=[];this.deletedAll=false;}
  async get(k){return this.map.get(k)}
  async put(k,v){
    if(k&&typeof k==='object'&&!Array.isArray(k)){
      for(const [key,value] of Object.entries(k)){this.map.set(key,structuredClone(value));this.putKeys.push(key)}
      return;
    }
    this.map.set(k,structuredClone(v));this.putKeys.push(k)
  }
  async delete(k){this.map.delete(k)}
  async deleteAll(){this.map.clear();this.deletedAll=true}
  async setAlarm(v){this.alarms.push(Number(v))}
}
class Socket {
  constructor(attachment={}){this.sent=[];this.attachment=attachment;this.closed=false;this.closeReason='';}
  serializeAttachment(v){this.attachment=structuredClone(v)}
  deserializeAttachment(){return this.attachment}
  send(v){this.sent.push(JSON.parse(String(v)))}
  close(_code,reason){this.closed=true;this.closeReason=String(reason||'')}
}

const descriptor={
  v:1,
  sessionId:'session-inactivity-123456789012345',
  roomCode:'ABCDE',
  hostInstanceId:'host-12345678',
  hostInviteToken:'host-token-1234567890',
  playerInviteToken:'player-token-1234567890',
  tvInviteToken:'tv-token-1234567890123',
  localCandidates:['http://192.168.1.4:8765'],
  cloudBaseUrl:'https://example.invalid',
  expiresAt:Date.now()+7*24*60*60*1000,
};

const aliasCalls=[];
const env={ALIASES:{getByName:code=>({fetch:async(_url,init)=>{aliasCalls.push({code,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}})}})}};

// Initialisierung setzt nicht nur die siebentägige Höchstlaufzeit, sondern den
// 15-Minuten-Inaktivitätsalarm.
const storage=new Storage();
const sockets=[];
const ctx={storage,getWebSockets:()=>sockets,acceptWebSocket(){}};
const room=new SessionRoom(ctx,env);
const before=Date.now();
const initResponse=await room.fetch(new Request('https://session/init',{method:'POST',body:JSON.stringify(descriptor)}));
assert.equal(initResponse.status,200);
const initBody=await initResponse.json();
assert.equal(initBody.ok,true);
assert.equal(storage.map.has('lastHostActivityAt'),true);
assert.equal(storage.alarms.length,1);
assert.ok(storage.alarms[0]>=before+14*60*1000,'alarm must be near 15 minutes');
assert.ok(storage.alarms[0]<=Date.now()+16*60*1000,'alarm must not use seven-day expiry');

// Echte Hostaktivität verlängert die Frist mit dem gemeldeten Zeitstempel.
const activityAt=Date.now();
storage.alarms.length=0;
const activityResponse=await room.fetch(new Request('https://session/activity',{method:'POST',body:JSON.stringify({
  hostInviteToken:descriptor.hostInviteToken,
  activityAt,
})}));
const activityBody=await activityResponse.json();
assert.equal(activityBody.ok,true);
assert.equal(activityBody.activityAt>=activityAt,true);
assert.equal(storage.alarms.length,1);
assert.ok(storage.alarms[0]>=activityAt+14*60*1000);

// Wenn die 15-Minuten-Grenze erreicht ist und der Host-Kontrollkanal noch lebt,
// fragt der Worker einmal nach und wartet 15 Sekunden. Die Rückfrage selbst
// schließt den Raum noch nicht und zählt nicht als Aktivität.
const staleDescriptor={...descriptor};
const staleStorage=new Storage({
  descriptor:staleDescriptor,
  lastHostActivityAt:Date.now()-15*60*1000-1500,
});
const host=new Socket({authenticated:true,selected:true,role:'host',participantId:descriptor.hostInstanceId});
const player=new Socket({authenticated:true,selected:true,role:'player',participantId:'player-1'});
const staleRoom=new SessionRoom({storage:staleStorage,getWebSockets:()=>[host,player],acceptWebSocket(){}},env);
await staleRoom.alarm();
assert.equal(host.sent.at(-1)?.type,'SESSION_ACTIVITY_CHECK');
assert.equal(player.sent.length,0);
assert.equal(host.closed,false);
assert.equal(staleStorage.deletedAll,false);
assert.equal(staleStorage.map.has('pendingInactivityCheck'),true);
const pending=staleStorage.map.get('pendingInactivityCheck');
assert.ok(Number(pending.deadline)>=Date.now()+14000);

// Antwortet die App mit tatsächlich neuer lokaler Aktivität, wird die Rückfrage
// gelöscht und die reguläre 15-Minuten-Frist neu geplant.
const confirmedAt=Date.now();
const confirmResponse=await staleRoom.fetch(new Request('https://session/activity',{method:'POST',body:JSON.stringify({
  hostInviteToken:descriptor.hostInviteToken,
  activityAt:confirmedAt,
})}));
assert.equal(confirmResponse.status,200);
assert.equal(staleStorage.map.has('pendingInactivityCheck'),false);
assert.equal(staleStorage.map.get('lastHostActivityAt')>=confirmedAt,true);
assert.equal(host.closed,false);

// Bleibt die Bestätigung aus, beendet erst der zweite Alarm nach Ablauf der
// 15-Sekunden-Nachfrist den Raum und bereinigt den Alias.
const expireStorage=new Storage({
  descriptor:staleDescriptor,
  lastHostActivityAt:Date.now()-15*60*1000-20000,
  pendingInactivityCheck:{activityAt:Date.now()-15*60*1000-20000,requestedAt:Date.now()-20000,deadline:Date.now()-1000},
});
const expireHost=new Socket({authenticated:true,selected:true,role:'host',participantId:descriptor.hostInstanceId});
const expirePlayer=new Socket({authenticated:true,selected:true,role:'player',participantId:'player-2'});
const expireRoom=new SessionRoom({storage:expireStorage,getWebSockets:()=>[expireHost,expirePlayer],acceptWebSocket(){}},env);
await expireRoom.alarm();
for(const socket of [expireHost,expirePlayer]){
  assert.equal(socket.sent.at(-1)?.type,'SESSION_ENDED');
  assert.equal(socket.sent.at(-1)?.payload?.reason,'host_inactive_15m');
  assert.equal(socket.closed,true);
}
assert.equal(expireStorage.deletedAll,true);
assert.equal(aliasCalls.some(call=>call.code===descriptor.roomCode&&call.body.sessionId===descriptor.sessionId),true);

// Ein Alias darf nur von der zugehörigen Session gelöscht werden.
const aliasStorage=new Storage({descriptor});
const alias=new RoomAlias({storage:aliasStorage},{});
const wrong=await alias.fetch(new Request('https://alias/delete',{method:'POST',body:JSON.stringify({sessionId:'other-session-123456789'})}));
assert.equal(wrong.status,409);
assert.equal(aliasStorage.map.has('descriptor'),true);
const right=await alias.fetch(new Request('https://alias/delete',{method:'POST',body:JSON.stringify({sessionId:descriptor.sessionId})}));
assert.equal(right.status,200);
assert.equal(aliasStorage.map.size,0);

console.log('Inaktivitätsvertrag: 15-Minuten-Frist, 15-Sekunden-Bestätigung, sparsames Aktivitätssignal und Alias-Bereinigung bestanden');
