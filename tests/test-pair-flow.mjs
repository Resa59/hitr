import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let source=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
source=source
 .replace('import { DurableObject } from "cloudflare:workers";','class DurableObject { constructor(ctx, env) { this.ctx=ctx; this.env=env; } }')
 .replace('export default {','const workerDefault = {')
 .replaceAll('export class ','class ')
 .concat('\n;globalThis.__classes={PairRoom};');
const context={console,TextEncoder,TextDecoder,crypto:globalThis.crypto,btoa:v=>Buffer.from(v,'binary').toString('base64'),Response,Request,Headers,URL,WebSocketPair:class {}};
vm.createContext(context);vm.runInContext(source,context,{filename:'worker.js'});
const {PairRoom}=context.__classes;
class Storage{constructor(){this.map=new Map();this.alarms=[]}async get(k){return this.map.get(k)}async put(k,v){this.map.set(k,structuredClone(v))}async setAlarm(v){this.alarms.push(v)}async deleteAll(){this.map.clear()}}
const sent=[];const ctx={storage:new Storage(),getWebSockets:()=>[{send:v=>sent.push(JSON.parse(String(v)))}],acceptWebSocket(){}};
const room=new PairRoom(ctx,{});
const created=await room.fetch(new Request('https://pair/create',{method:'POST',body:JSON.stringify({code:'123456',origin:'https://hitr.example'})}));
assert.equal(created.status,201);const c=await created.json();assert.equal(c.ok,true);assert.equal(c.code,'123456');assert.ok(c.pairToken.length>=16);assert.ok(c.pairUrl.endsWith(`/p/123456/${c.pairToken}`));assert.equal(ctx.storage.alarms.length,1);
const invalid=await room.fetch(new Request('https://pair/realtime-claim',{method:'POST',body:JSON.stringify({pairToken:'wrong',sessionId:'session-12345678901234567890',tvInviteToken:'tv-token-12345678901234567890'})}));
assert.equal(invalid.status,403);
const body={pairToken:c.pairToken,sessionId:'session-12345678901234567890',tvInviteToken:'tv-token-12345678901234567890',localCandidates:['http://192.168.1.2:8766'],cloudBaseUrl:'https://hitr.example'};
const claimed=await room.fetch(new Request('https://pair/realtime-claim',{method:'POST',body:JSON.stringify(body)}));
assert.equal(claimed.status,200);assert.deepEqual(await claimed.json(),{ok:true,status:'approved'});
const state=await ctx.storage.get('state');assert.equal(state.realtimeDescriptor.sessionId,body.sessionId);assert.equal(state.realtimeDescriptor.inviteToken,body.tvInviteToken);assert.deepEqual(state.realtimeDescriptor.localCandidates,body.localCandidates);assert.equal(sent.at(-1).type,'REALTIME_DESCRIPTOR');
console.log('TV-QR-Pairing: Codeerzeugung, Tokenprüfung und Realtime-Descriptor-Zustellung bestanden');
