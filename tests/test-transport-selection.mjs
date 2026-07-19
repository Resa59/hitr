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
  console,
  TextEncoder,TextDecoder,
  crypto:globalThis.crypto,
  btoa:value=>Buffer.from(value,'binary').toString('base64'),
  Response,Request,Headers,URL,
  WebSocketPair:class {},
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'worker.js'});
const {SessionRoom,RoomAlias}=context.__classes;

class Storage {
  constructor(initial={}){this.map=new Map(Object.entries(initial));this.alarms=[];this.putKeys=[];}
  async get(k){return this.map.get(k)}
  async put(k,v){
    if(k&&typeof k==='object'&&!Array.isArray(k)){
      for(const [key,value] of Object.entries(k)){this.map.set(key,structuredClone(value));this.putKeys.push(key)}
      return;
    }
    this.map.set(k,structuredClone(v));this.putKeys.push(k)
  }
  async delete(k){this.map.delete(k)}
  async deleteAll(){this.map.clear()}
  async setAlarm(v){this.alarms.push(v)}
}
class Socket {
  constructor(){this.sent=[];this.attachment={};this.closed=false;}
  serializeAttachment(v){this.attachment=structuredClone(v)}
  deserializeAttachment(){return this.attachment}
  send(v){this.sent.push(JSON.parse(String(v)))}
  close(){this.closed=true}
}
const descriptor={sessionId:'session-12345678901234567890',hostInstanceId:'host-12345678',hostInviteToken:'host-token-1234567890',playerInviteToken:'player-token-1234567890',tvInviteToken:'tv-token-1234567890123',localCandidates:['http://192.168.1.4:8787'],expiresAt:Date.now()+60000};
const storage=new Storage({descriptor});
const host=new Socket();host.attachment={authenticated:true,selected:true,role:'host',participantId:descriptor.hostInstanceId,displayName:'Haupthandy'};
const player=new Socket();
const sockets=[host,player];
const ctx={storage,getWebSockets:()=>sockets,acceptWebSocket(){}};
const room=new SessionRoom(ctx,{});

const hello={payload:{role:'player',inviteToken:descriptor.playerInviteToken,displayName:'Resa',participantId:'',resumeToken:''}};
storage.putKeys.length=0;
await room.authenticate(player,hello);
assert.equal(storage.putKeys.some(key=>key.startsWith("participant:")),false,"bootstrap-only authentication must not persist participant");
assert.equal(player.sent.length,1);
assert.equal(player.sent[0].type,'WELCOME');
assert.equal(player.sent[0].payload.bootstrapOnly,true);
assert.equal(player.sent[0].payload.snapshot,null);
assert.deepEqual(player.sent[0].payload.localCandidates,descriptor.localCandidates);
assert.equal(player.attachment.selected,false);
assert.equal(storage.map.has('roster'),false,'pending player must not enter roster');
assert.equal(host.sent.some(m=>m.type==='CLIENT_READY'),false,'host must not receive READY before selection');

const selection={payload:{transport:'cloud',resumed:false}};
await room.selectTransport(player,selection,descriptor,player.attachment);
assert.equal(player.attachment.selected,true);
const confirmed=player.sent.find(m=>m.type==='TRANSPORT_CONFIRMED');
assert(confirmed,'Transportbestätigung fehlt');
assert.equal(confirmed.payload.transport,'cloud');
assert(player.sent.some(m=>m.type==='PRESENCE'),'Browser erhält vollständige Warteraumliste');
assert.equal(host.sent.some(m=>m.type==='CLIENT_READY'&&m.payload.needsSnapshot===true),true);
assert.equal(storage.map.get('roster')[player.attachment.participantId].displayName,'Resa');
assert.equal(storage.map.has(`participant:${player.attachment.participantId}`),true,'cloud selection persists resume record');
const readyCount=host.sent.filter(m=>m.type==='CLIENT_READY').length;
storage.putKeys.length=0;
await room.selectTransport(player,selection,descriptor,player.attachment);
assert.equal(storage.putKeys.length,0,'repeated cloud selection must not write unchanged records');
assert.equal(host.sent.filter(m=>m.type==='CLIENT_READY').length,readyCount,'repeated selection must not request another snapshot');

const before=player.sent.length;
room.routeFromHost({target:{role:'player'},type:'PLAYER_STATE',payload:{phase:'playing'}});
assert.equal(player.sent.length,before+1,'selected player receives host state');
player.attachment.selected=false;
room.routeFromHost({target:{role:'player'},type:'PLAYER_STATE',payload:{phase:'playing'}});
assert.equal(player.sent.length,before+1,'pending player receives no host state');

storage.putKeys.length=0;
const hostMessage={v:1,type:'PLAYER_STATE',sessionId:descriptor.sessionId,messageId:'message-123456',sentAt:Date.now(),payload:{phase:'lobby'},target:{role:'player'}};
await room.webSocketMessage(host,JSON.stringify(hostMessage));
assert.equal(storage.putKeys.includes('playerSnapshot'),false);
assert.equal(storage.putKeys.includes('tvSnapshot'),false);

const aliasStorage=new Storage();
const alias=new RoomAlias({storage:aliasStorage},{});
await alias.fetch(new Request('https://alias/bind',{method:'POST',body:JSON.stringify(descriptor)}));
assert.equal(aliasStorage.alarms.length,1,'alias expiry alarm');
const aliasWrites=aliasStorage.putKeys.length;
await alias.fetch(new Request('https://alias/bind',{method:'POST',body:JSON.stringify(descriptor)}));
assert.equal(aliasStorage.putKeys.length,aliasWrites,'unchanged alias bind must not write');
assert.equal(aliasStorage.alarms.length,1,'unchanged alias bind must not reset alarm');

storage.putKeys.length=0;storage.alarms.length=0;
const update=await room.fetch(new Request('https://session/update',{method:'POST',body:JSON.stringify({hostInviteToken:descriptor.hostInviteToken,localCandidates:descriptor.localCandidates})}));
const updateBody=await update.json();
assert.equal(updateBody.descriptorChanged,false);
assert.equal(storage.putKeys.length,0,'unchanged candidate update must not write');
assert.equal(storage.alarms.length,0,'unchanged candidate update must not reset alarm');
console.log('Runtime-Vertrag: Vermittlung vor Transportwahl, verzögerte Teilnehmerpersistenz, kein Snapshot-Speicher und sparsame Ablaufverwaltung bestanden');
