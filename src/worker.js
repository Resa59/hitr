import { DurableObject } from "cloudflare:workers";

const VERSION = 1;
const BUILD = "1.4.18-diagnose1";
const CAPABILITIES = ["transport-selection-v1", "tv-pair-v1", "host-activity-timeout-v1"];
const MAX_BYTES = 32 * 1024;
const SESSION_INACTIVITY_MS = 15 * 60 * 1000;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_TYPES = new Set(["TRANSPORT_SELECTED", "ANSWER_SUBMITTED", "SCORE_CONFIRMED", "CLIENT_READY", "ACK", "PING", "LEAVE"]);
const TV_TYPES = new Set(["TRANSPORT_SELECTED", "TV_READY", "TV_AUDIO_CAPABILITY", "ACK", "PING", "LEAVE"]);
const HOST_TYPES = new Set(["PLAYER_SNAPSHOT", "PLAYER_STATE", "PLAYER_PRIVATE_STATE", "TV_SNAPSHOT", "TV_STATE", "SESSION_ENDED", "ERROR", "PRESENCE", "TV_AUDIO_TOKEN"]);
const ANDROID_ASSET_LINKS = [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: "de.resa.hitstertrainer",
    sha256_cert_fingerprints: ["27:F6:22:E6:79:0D:91:66:5A:60:67:4B:8A:36:D1:72:2E:6C:77:7F:59:5A:ED:FF:1E:4A:35:92:23:83:A0:DC"]
  }
}];

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function cors(response) {
  const h = new Headers(response.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h, webSocket: response.webSocket });
}
function clean(value, max = 240) { return String(value ?? "").trim().slice(0, max); }
function bytes(value) { return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length; }
function token(byteCount = 24) {
  const data = new Uint8Array(byteCount); crypto.getRandomValues(data);
  let binary = ""; for (const v of data) binary += String.fromCharCode(v);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function roomCode(length = 5) {
  const data = new Uint8Array(length); crypto.getRandomValues(data);
  return Array.from(data, v => ROOM_ALPHABET[v % ROOM_ALPHABET.length]).join("");
}
function numericCode() {
  const data = new Uint32Array(1); crypto.getRandomValues(data);
  return String(data[0] % 1000000).padStart(6, "0");
}
function envelope(type, sessionId, payload = {}, options = {}) {
  const out = { v: VERSION, type, sessionId, messageId: options.messageId || token(12), sentAt: Date.now(), payload };
  if (Number.isInteger(options.sequence)) out.sequence = options.sequence;
  if (options.sender) out.sender = options.sender;
  if (options.target) out.target = options.target;
  return out;
}
function assertMessage(value, sid) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Nachricht ist kein Objekt.");
  if (value.v !== VERSION || clean(value.sessionId, 180) !== sid) throw new Error("Ungültige Sitzung oder Protokollversion.");
  if (!/^[A-Z0-9_]{1,64}$/.test(clean(value.type, 64))) throw new Error("Ungültiger Nachrichtentyp.");
  if (clean(value.messageId, 180).length < 8 || !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) throw new Error("Ungültige Nachrichtenhülle.");
  if (bytes(value) > MAX_BYTES) throw new Error("Nachricht überschreitet 32 KiB.");
  return value;
}
async function readJson(request) {
  const text = await request.text();
  if (bytes(text) > 64 * 1024) throw new Error("Anfrage zu groß.");
  return text ? JSON.parse(text) : {};
}
function publicJoin(descriptor, role, origin) {
  return {
    v: VERSION,
    sessionId: descriptor.sessionId,
    role,
    inviteToken: role === "tv" ? descriptor.tvInviteToken : descriptor.playerInviteToken,
    roomCode: descriptor.roomCode,
    localCandidates: Array.isArray(descriptor.localCandidates) ? descriptor.localCandidates : [],
    cloudBaseUrl: descriptor.cloudBaseUrl || origin,
    expiresAt: Number(descriptor.expiresAt || 0),
    protocolVersion: VERSION,
    cloudBuild: BUILD,
    capabilities: CAPABILITIES
  };
}
function wsAttachment(ws) { try { return ws.deserializeAttachment() || {}; } catch (_) { return {}; } }
function safeSend(ws, value) { try { ws.send(typeof value === "string" ? value : JSON.stringify(value)); return 1; } catch (_) { return 0; } }

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    try {
      if (url.pathname === "/.well-known/assetlinks.json" && request.method === "GET") {
        return json(ANDROID_ASSET_LINKS, 200, { "content-type": "application/json; charset=utf-8" });
      }
      const tvAppLink = url.pathname.match(/^\/p\/(\d{6})\/([A-Za-z0-9_-]{20,})\/?$/);
      if (tvAppLink && request.method === "GET") {
        return env.ASSETS.fetch(new Request(`${url.origin}/open-app.html`, request));
      }
      const shortJoin = url.pathname.match(/^\/j\/([A-Z0-9]{3,12})\/?$/i);
      if (shortJoin && request.method === "GET") {
        const code = clean(shortJoin[1], 12).toUpperCase();
        return Response.redirect(`${url.origin}/play/?code=${encodeURIComponent(code)}`, 302);
      }
      if (url.pathname === "/api/health" || url.pathname === "/api/realtime/health") {
        return cors(json({ ok: true, protocolVersion: VERSION, build: BUILD, capabilities: CAPABILITIES, service: "hitster-cloud-first", realtime: true }));
      }
      if (url.pathname === "/api/realtime/session/open" && request.method === "POST") {
        const body = await readJson(request);
        const sid = clean(body.sessionId, 180);
        if (sid.length < 16 || clean(body.hostInviteToken, 240).length < 16) return cors(json({ ok: false, error: "Ungültige Sitzungsdaten." }, 400));
        const code = clean(body.roomCode || roomCode(), 12).toUpperCase();
        const descriptor = {
          v: VERSION, sessionId: sid, roomCode: code,
          hostInstanceId: clean(body.hostInstanceId, 180), hostInviteToken: clean(body.hostInviteToken, 240),
          playerInviteToken: clean(body.playerInviteToken, 240), tvInviteToken: clean(body.tvInviteToken, 240),
          localCandidates: Array.isArray(body.localCandidates) ? [...new Set(body.localCandidates.map(String).filter(Boolean))].slice(0, 8) : [],
          cloudBaseUrl: url.origin, expiresAt: Math.min(Number(body.expiresAt || Date.now() + 7 * 24 * 3600000), Date.now() + 7 * 24 * 3600000)
        };
        const room = env.SESSIONS.getByName(sid);
        const initialized = await room.fetch("https://session/init", { method: "POST", body: JSON.stringify(descriptor) });
        const result = await initialized.json();
        if (!initialized.ok) return cors(json(result, initialized.status));
        await env.ALIASES.getByName(code).fetch("https://alias/bind", { method: "POST", body: JSON.stringify(descriptor) });
        return cors(json({ ok: true, protocolVersion: VERSION, build: BUILD, capabilities: CAPABILITIES, session: result.session || descriptor }));
      }
      if (url.pathname === "/api/realtime/session/update" && request.method === "POST") {
        const body = await readJson(request); const sid = clean(body.sessionId, 180);
        const response = await env.SESSIONS.getByName(sid).fetch("https://session/update", { method: "POST", body: JSON.stringify(body) });
        const result = await response.json();
        if (response.ok && result.descriptorChanged === true && result.descriptor?.roomCode) {
          await env.ALIASES.getByName(result.descriptor.roomCode).fetch("https://alias/bind", { method: "POST", body: JSON.stringify(result.descriptor) });
        }
        return cors(json(result, response.status));
      }
      if (url.pathname === "/api/realtime/session/activity" && request.method === "POST") {
        const body = await readJson(request); const sid = clean(body.sessionId, 180);
        const response = await env.SESSIONS.getByName(sid).fetch("https://session/activity", { method: "POST", body: JSON.stringify(body) });
        return cors(response);
      }
      if (url.pathname === "/api/realtime/session/kick" && request.method === "POST") {
        const body = await readJson(request); const sid = clean(body.sessionId, 180);
        const response = await env.SESSIONS.getByName(sid).fetch("https://session/kick", { method: "POST", body: JSON.stringify(body) });
        return cors(response);
      }
      if (url.pathname === "/api/realtime/session/end" && request.method === "POST") {
        const body = await readJson(request); const sid = clean(body.sessionId, 180);
        const response = await env.SESSIONS.getByName(sid).fetch("https://session/end", { method: "POST", body: JSON.stringify(body) });
        return cors(response);
      }
      if (url.pathname === "/api/realtime/resolve" && request.method === "GET") {
        const code = clean(url.searchParams.get("code"), 12).toUpperCase();
        const role = url.searchParams.get("role") === "tv" ? "tv" : "player";
        const response = await env.ALIASES.getByName(code).fetch(`https://alias/resolve?role=${role}&origin=${encodeURIComponent(url.origin)}`);
        return cors(response);
      }
      if (url.pathname === "/api/realtime/ws") {
        const sid = clean(url.searchParams.get("sid"), 180);
        if (sid.length < 16) return cors(json({ ok: false, error: "sessionId fehlt." }, 400));
        return env.SESSIONS.getByName(sid).fetch(request);
      }
      if (url.pathname === "/api/realtime/pair/create" && request.method === "POST") {
        let code = "", result = null;
        for (let i = 0; i < 8; i++) {
          code = numericCode();
          const response = await env.PAIRS.getByName(code).fetch("https://pair/create", { method: "POST", body: JSON.stringify({ code, origin: url.origin }) });
          if (response.status === 201) { result = await response.json(); break; }
        }
        return cors(result ? json(result, 201) : json({ ok: false, error: "Kein freier TV-Code verfügbar." }, 503));
      }
      if (url.pathname === "/api/realtime/pair/claim" && request.method === "POST") {
        const body = await readJson(request); const code = clean(body.code, 6).replace(/\D/g, "");
        return cors(await env.PAIRS.getByName(code).fetch("https://pair/realtime-claim", { method: "POST", body: JSON.stringify(body) }));
      }
      if (url.pathname === "/api/realtime/pair/ws") {
        const code = clean(url.searchParams.get("code"), 6).replace(/\D/g, "");
        return env.PAIRS.getByName(code).fetch(request);
      }
      const legacy = url.pathname.match(/^\/api\/session\/(\d{6})\/(claim-qr|request-code|claim-status|state|heartbeat)$/);
      if (legacy && request.method === "POST") {
        return cors(await env.PAIRS.getByName(legacy[1]).fetch(`https://pair/${legacy[2]}`, { method: "POST", body: await request.text() }));
      }
      if (url.pathname === "/api/realtime/pair/approve" && request.method === "POST") {
        const body = await readJson(request); const code = clean(body.code, 6).replace(/\D/g, "");
        return cors(await env.PAIRS.getByName(code).fetch("https://pair/approve", { method: "POST", body: JSON.stringify(body) }));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return cors(json({ ok: false, error: error?.message || String(error) }, 500));
    }
  }
};

export class RoomAlias extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/bind") {
      const d = await readJson(request);
      const existing = await this.ctx.storage.get("descriptor");
      const changed = JSON.stringify(existing || null) !== JSON.stringify(d);
      if (changed) {
        await this.ctx.storage.put("descriptor", d);
        const expiresAt = Number(d.expiresAt || 0);
        if (expiresAt > Date.now()) await this.ctx.storage.setAlarm(expiresAt);
      }
      return json({ ok: true, changed });
    }
    if (url.pathname === "/resolve") {
      const d = await this.ctx.storage.get("descriptor");
      if (!d || Number(d.expiresAt || 0) < Date.now()) {
        await this.ctx.storage.deleteAll();
        return json({ ok: false, error: "Raumcode nicht gefunden oder abgelaufen." }, 404);
      }
      return json(publicJoin(d, url.searchParams.get("role") === "tv" ? "tv" : "player", url.searchParams.get("origin") || d.cloudBaseUrl));
    }
    if (url.pathname === "/delete") {
      const body = await readJson(request);
      const d = await this.ctx.storage.get("descriptor");
      if (!d || clean(body.sessionId, 180) === clean(d.sessionId, 180)) {
        await this.ctx.storage.deleteAll();
        return json({ ok: true, deleted: !!d });
      }
      return json({ ok: false, error: "Raumcode gehört zu einer anderen Sitzung." }, 409);
    }
    return json({ ok: false, error: "Nicht gefunden." }, 404);
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export class SessionRoom extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.descriptor = null; this.sequence = 0; this.recent = new Set(); }
  async descriptorValue() { return this.descriptor || (this.descriptor = await this.ctx.storage.get("descriptor")); }
  sockets() { return this.ctx.getWebSockets(); }
  async scheduleLifecycleAlarm(descriptor, lastActivityAt = null) {
    if (!descriptor) return;
    const now = Date.now();
    const storedActivity = lastActivityAt == null ? await this.ctx.storage.get("lastHostActivityAt") : lastActivityAt;
    const activity = Number(storedActivity || now);
    const deadlines = [Number(descriptor.expiresAt || now + SESSION_INACTIVITY_MS), activity + SESSION_INACTIVITY_MS];
    if (descriptor.ended) deadlines.push(Number(descriptor.deleteAfter || now));
    const deadline = Math.max(now + 1000, Math.min(...deadlines.filter(Number.isFinite)));
    await this.ctx.storage.setAlarm(deadline);
  }
  async deleteAlias(descriptor) {
    const code = clean(descriptor?.roomCode, 12).toUpperCase();
    const sid = clean(descriptor?.sessionId, 180);
    if (!code || !sid) return;
    try {
      await this.env.ALIASES.getByName(code).fetch("https://alias/delete", {
        method: "POST", body: JSON.stringify({ sessionId: sid })
      });
    } catch (_) {}
  }
  async closeAndDelete(descriptor, reason) {
    if (descriptor?.sessionId) {
      const ended = envelope("SESSION_ENDED", descriptor.sessionId, {
        reason: clean(reason || "session_closed", 80), rejoinAllowed: false, deleteAfterMs: 0, finalSnapshot: null
      }, { sender: { role: "server", id: "cloud" }, target: { role: "all", participantId: null } });
      for (const ws of this.sockets()) safeSend(ws, ended);
      for (const ws of this.sockets()) try { ws.close(1001, clean(reason || "session closed", 80)); } catch (_) {}
    }
    await this.deleteAlias(descriptor);
    await this.ctx.storage.deleteAll();
    this.descriptor = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init") {
      const incoming = await readJson(request); const existing = await this.descriptorValue();
      if (existing && existing.hostInviteToken !== incoming.hostInviteToken) return json({ ok: false, error: "Sitzung ist bereits belegt." }, 409);
      this.descriptor = { ...(existing || {}), ...incoming, ended: false };
      delete this.descriptor.endReason;
      delete this.descriptor.deleteAfter;
      const now = Date.now();
      await this.ctx.storage.put({ descriptor: this.descriptor, lastHostActivityAt: now });
      await this.scheduleLifecycleAlarm(this.descriptor, now);
      return json({ ok: true, session: this.descriptor, inactivityDeadline: now + SESSION_INACTIVITY_MS });
    }
    if (url.pathname === "/update") {
      const body = await readJson(request), d = await this.descriptorValue();
      if (!d || body.hostInviteToken !== d.hostInviteToken) return json({ ok: false, error: "Host-Autorisierung ungültig." }, 403);
      const nextCandidates = Array.isArray(body.localCandidates) ? [...new Set(body.localCandidates.map(String).filter(Boolean))].slice(0, 8) : [];
      const descriptorChanged = JSON.stringify(d.localCandidates || []) !== JSON.stringify(nextCandidates);
      if (descriptorChanged) {
        d.localCandidates = nextCandidates;
        this.descriptor = d;
        await this.ctx.storage.put("descriptor", d);
      }
      return json({ ok: true, descriptorChanged, localCandidates: d.localCandidates || [], descriptor: d });
    }
    if (url.pathname === "/activity") {
      const body = await readJson(request), d = await this.descriptorValue();
      if (!d || body.hostInviteToken !== d.hostInviteToken) return json({ ok: false, error: "Host-Autorisierung ungültig." }, 403);
      if (d.ended) return json({ ok: false, error: "Sitzung wurde bereits beendet." }, 410);
      const now = Date.now();
      const supplied = Number(body.activityAt || now);
      const activityAt = Math.max(now - SESSION_INACTIVITY_MS, Math.min(supplied, now + 30000));
      const previous = Number(await this.ctx.storage.get("lastHostActivityAt") || 0);
      const latest = Math.max(previous, activityAt);
      if (latest !== previous) await this.ctx.storage.put("lastHostActivityAt", latest);
      await this.scheduleLifecycleAlarm(d, latest);
      return json({ ok: true, activityAt: latest, inactivityDeadline: latest + SESSION_INACTIVITY_MS });
    }
    if (url.pathname === "/kick") {
      const body = await readJson(request), d = await this.descriptorValue();
      if (!d || body.hostInviteToken !== d.hostInviteToken) return json({ ok: false, error: "Host-Autorisierung ungültig." }, 403);
      const role = clean(body.role || "player", 20), participantId = clean(body.participantId, 180), reason = clean(body.reason || "Vom Haupthandy entfernt", 120);
      const roster = (await this.ctx.storage.get("roster")) || {};
      const ids = Object.values(roster).filter(record => record.role === role && (!participantId || record.participantId === participantId)).map(record => record.participantId);
      let removed = 0;
      for (const id of ids) {
        const record = roster[id]; if (!record) continue;
        delete roster[id]; removed++;
        await this.ctx.storage.delete(`participant:${id}`);
        const notice = envelope("REMOVED", d.sessionId, { reason }, { sender: { role: "host", id: d.hostInstanceId }, target: { role, participantId: id } });
        for (const socket of this.sockets()) {
          const a = wsAttachment(socket); if (a.participantId !== id || a.role !== role) continue;
          safeSend(socket, notice); try { socket.close(4003, "removed"); } catch (_) {}
        }
      }
      if (removed > 0) {
        await this.ctx.storage.put("roster", roster);
        await this.publishPresence();
      }
      return json({ ok: true, removed });
    }
    if (url.pathname === "/end") {
      const body = await readJson(request), d = await this.descriptorValue();
      if (!d || body.hostInviteToken !== d.hostInviteToken) return json({ ok: false, error: "Host-Autorisierung ungültig." }, 403);
      d.ended = true; d.endReason = clean(body.reason || "host_closed_room", 80); d.deleteAfter = Date.now() + Math.max(0, Math.min(Number(body.graceMs || 0), 3600000));
      this.descriptor = d; await this.ctx.storage.put("descriptor", d);
      const ended = envelope("SESSION_ENDED", d.sessionId, {
        reason: d.endReason, rejoinAllowed: false, deleteAfterMs: Math.max(0, d.deleteAfter - Date.now()), finalSnapshot: null
      }, { sender: { role: "server", id: "cloud" }, target: { role: "all", participantId: null } });
      for (const ws of this.sockets()) safeSend(ws, ended);
      await this.scheduleLifecycleAlarm(d);
      return json({ ok: true, deleteAfter: d.deleteAfter });
    }
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const d = await this.descriptorValue();
      if (!d || d.ended || Number(d.expiresAt || 0) < Date.now()) return new Response("Session abgelaufen", { status: 410 });
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ authenticated: false, connectedAt: Date.now() });
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ ok: false, error: "Nicht gefunden." }, 404);
  }
  async authenticate(ws, message) {
    const d = await this.descriptorValue(), p = message.payload || {}, role = clean(p.role, 20);
    if (!d) throw new Error("Sitzung fehlt.");
    const expected = role === "host" ? d.hostInviteToken : role === "tv" ? d.tvInviteToken : d.playerInviteToken;
    if (!expected || clean(p.inviteToken, 240) !== expected) throw new Error("Einladung ungültig.");
    if (role === "host" && clean(p.hostInstanceId, 180) !== d.hostInstanceId) throw new Error("Host-ID ungültig.");

    let participantId = role === "host" ? d.hostInstanceId : clean(p.participantId, 180);
    let resumeToken = clean(p.resumeToken, 240);
    let record = null;
    let participantPersisted = role === "host";
    let participantDirty = false;
    if (role === "host") {
      resumeToken = d.hostInviteToken;
      record = { participantId, resumeToken, role, displayName: "Haupthandy" };
    } else {
      const storedRecord = participantId ? await this.ctx.storage.get(`participant:${participantId}`) : null;
      participantPersisted = !!storedRecord && storedRecord.role === role && !!resumeToken && storedRecord.resumeToken === resumeToken;
      if (participantPersisted) {
        record = { ...storedRecord };
        if (p.displayName) {
          const nextDisplayName = clean(p.displayName, 80);
          participantDirty = nextDisplayName !== record.displayName;
          record.displayName = nextDisplayName;
        }
      } else {
        participantId = participantId.length >= 8 ? participantId : token(18);
        resumeToken = token(24);
        record = { participantId, resumeToken, role, displayName: clean(p.displayName || (role === "tv" ? "Hitster TV" : "Spieler"), 80) };
      }
      // Ein reiner Cloud-Bootstrap soll keine Durable-Object-Schreiboperation
      // verursachen. Der Teilnehmerdatensatz wird erst bei Cloud-Auswahl gespeichert.
    }

    for (const other of this.sockets()) {
      if (other === ws) continue;
      const a = wsAttachment(other);
      if (a.authenticated && a.role === role && a.participantId === participantId) {
        if (a.selected) { a.selected = false; other.serializeAttachment(a); }
        try { other.close(4001, "replaced"); } catch (_) {}
      }
    }
    const attachment = { authenticated: true, selected: role === "host", participantPersisted, participantDirty, role, participantId, resumeToken, displayName: record.displayName, joinedAt: Date.now() };
    ws.serializeAttachment(attachment);
    safeSend(ws, envelope("WELCOME", d.sessionId, {
      role,
      participantId,
      resumeToken,
      transport: "cloud",
      bootstrapOnly: role !== "host",
      localCandidates: Array.isArray(d.localCandidates) ? d.localCandidates : [],
      snapshot: null,
      protocolVersion: VERSION,
      serverBuild: BUILD,
      capabilities: CAPABILITIES
    }, { sequence: 0, sender: { role: "server", id: "cloud" }, target: { role, participantId } }));
    if (role === "host") await this.publishPresence();
  }

  async selectTransport(ws, message, d, attachment) {
    if (attachment.role === "host") throw new Error("Host benötigt keine Transportauswahl.");
    const selected = clean(message.payload?.transport, 20);
    if (selected !== "cloud" && selected !== "local") throw new Error("Ungültige Transportauswahl.");
    const roster = (await this.ctx.storage.get("roster")) || {};
    let presenceChanged = false;
    if (selected === "cloud") {
      const becameSelected = !attachment.selected;
      const priorRoster = roster[attachment.participantId];
      const rosterChanged = !priorRoster || priorRoster.role !== attachment.role || priorRoster.displayName !== attachment.displayName;
      const participantRecord = { participantId: attachment.participantId, resumeToken: attachment.resumeToken, role: attachment.role, displayName: attachment.displayName };
      if (!attachment.participantPersisted || attachment.participantDirty) {
        await this.ctx.storage.put(`participant:${attachment.participantId}`, participantRecord);
        attachment.participantPersisted = true;
        attachment.participantDirty = false;
      }
      attachment.selected = true;
      ws.serializeAttachment(attachment);
      roster[attachment.participantId] = { participantId: attachment.participantId, role: attachment.role, displayName: attachment.displayName };
      if (rosterChanged) await this.ctx.storage.put("roster", roster);
      presenceChanged = becameSelected;
      safeSend(ws, envelope("TRANSPORT_CONFIRMED", d.sessionId, { transport: "cloud", participantId: attachment.participantId, needsSnapshot: true }, {
        sender: { role: "server", id: "cloud" }, target: { role: attachment.role, participantId: attachment.participantId }
      }));
      if (becameSelected) {
        const readyType = attachment.role === "tv" ? "TV_READY" : "CLIENT_READY";
        const ready = envelope(readyType, d.sessionId, {
          participantId: attachment.participantId,
          displayName: attachment.displayName,
          role: attachment.role,
          transport: "cloud",
          resumed: !!message.payload?.resumed,
          needsSnapshot: true
        }, { sender: { role: attachment.role, id: attachment.participantId, name: attachment.displayName }, target: { role: "host", participantId: null } });
        for (const target of this.sockets()) if (wsAttachment(target).role === "host") safeSend(target, ready);
      }
    } else {
      const wasSelected = !!attachment.selected || !!roster[attachment.participantId];
      presenceChanged = wasSelected;
      attachment.selected = false;
      ws.serializeAttachment(attachment);
      if (roster[attachment.participantId]) delete roster[attachment.participantId];
      if (wasSelected) await this.ctx.storage.put("roster", roster);
      safeSend(ws, envelope("TRANSPORT_CONFIRMED", d.sessionId, { transport: "local", participantId: attachment.participantId, needsSnapshot: false }, {
        sender: { role: "server", id: "cloud" }, target: { role: attachment.role, participantId: attachment.participantId }
      }));
    }
    if (presenceChanged) await this.publishPresence();
  }

  async webSocketMessage(ws, raw) {
    try {
      const d = await this.descriptorValue(); if (!d) throw new Error("Sitzung fehlt.");
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      if (bytes(text) > MAX_BYTES) throw new Error("Nachricht überschreitet 32 KiB.");
      const message = assertMessage(JSON.parse(text), d.sessionId), a = wsAttachment(ws);
      if (!a.authenticated) { if (message.type !== "HELLO") throw new Error("HELLO erwartet."); await this.authenticate(ws, message); return; }
      if (message.type === "PING") { safeSend(ws, envelope("PONG", d.sessionId, {}, { sender: { role: "server", id: "cloud" } })); return; }
      if (message.type === "TRANSPORT_SELECTED") {
        await this.selectTransport(ws, message, d, a);
        return;
      }
      if (!a.selected && a.role !== "host") throw new Error("Transportauswahl ist noch nicht abgeschlossen.");
      if (message.type === "LEAVE") {
        message.sender = { role: a.role, id: a.participantId, name: a.displayName };
        message.target = { role: "host", participantId: null };
        for (const target of this.sockets()) if (wsAttachment(target).role === "host") safeSend(target, message);
        const roster = (await this.ctx.storage.get("roster")) || {};
        delete roster[a.participantId];
        await this.ctx.storage.put("roster", roster);
        await this.ctx.storage.delete(`participant:${a.participantId}`);
        try { ws.close(1000, "left"); } catch (_) {}
        await this.publishPresence();
        return;
      }
      if (this.recent.has(message.messageId)) return;
      this.recent.add(message.messageId); if (this.recent.size > 2048) this.recent.delete(this.recent.values().next().value);
      if (a.role === "host") {
        if (!HOST_TYPES.has(message.type)) throw new Error("Host-Nachrichtentyp nicht erlaubt.");
        // Spielzustände werden bewusst nicht im Durable Object gespeichert.
        // Der Host liefert nach abgeschlossener Transportwahl einen frischen Snapshot.
        this.routeFromHost(message);
      } else {
        const allowed = a.role === "tv" ? TV_TYPES : PLAYER_TYPES;
        if (!allowed.has(message.type)) throw new Error("Client-Nachrichtentyp nicht erlaubt.");
        message.sender = { role: a.role, id: a.participantId, name: a.displayName };
        message.target = { role: "host", participantId: null };
        for (const target of this.sockets()) if (wsAttachment(target).role === "host") safeSend(target, message);
      }
    } catch (error) {
      const d = await this.descriptorValue();
      safeSend(ws, envelope("ERROR", d?.sessionId || "invalid-session-id", { message: error?.message || String(error) }, { sender: { role: "server", id: "cloud" } }));
    }
  }
  routeFromHost(message) {
    const target = message.target || { role: "all" };
    for (const ws of this.sockets()) {
      const a = wsAttachment(ws); if (!a.authenticated || !a.selected || a.role === "host") continue;
      if (target.role !== "all" && a.role !== target.role) continue;
      if (target.participantId && a.participantId !== target.participantId) continue;
      safeSend(ws, message);
    }
  }
  async publishPresence() {
    const d = await this.descriptorValue(); if (!d) return;
    let players = 0, tv = 0; const online = new Set();
    for (const ws of this.sockets()) {
      const a = wsAttachment(ws); if (!a.authenticated || !a.selected) continue;
      online.add(a.participantId);
      if (a.role === "player") players++;
      if (a.role === "tv") tv++;
    }
    const roster = (await this.ctx.storage.get("roster")) || {};
    const playerList = Object.values(roster).filter(record => record.role === "player").map(record => ({ participantId: record.participantId, name: record.displayName, displayName: record.displayName, online: online.has(record.participantId) }));
    const message = envelope("PRESENCE", d.sessionId, { players, tv, playerList }, { sender: { role: "server", id: "cloud" }, target: { role: "host", participantId: null } });
    for (const ws of this.sockets()) if (wsAttachment(ws).role === "host") safeSend(ws, message);
  }
  async webSocketClose(ws) {
    const attachment = wsAttachment(ws);
    if (attachment.authenticated && attachment.selected && attachment.role !== "host") await this.publishPresence();
  }
  async webSocketError(ws) {
    const attachment = wsAttachment(ws);
    if (attachment.authenticated && attachment.selected && attachment.role !== "host") await this.publishPresence();
  }
  async alarm() {
    const d = await this.descriptorValue();
    if (!d) { await this.ctx.storage.deleteAll(); return; }
    const now = Date.now();
    const lastActivity = Number(await this.ctx.storage.get("lastHostActivityAt") || 0);
    const inactivityDeadline = (lastActivity || now) + SESSION_INACTIVITY_MS;
    const absoluteDeadline = Number(d.expiresAt || now);
    const endDeadline = d.ended ? Number(d.deleteAfter || now) : Number.POSITIVE_INFINITY;
    const nextDeadline = Math.min(inactivityDeadline, absoluteDeadline, endDeadline);
    if (nextDeadline > now + 750) {
      await this.ctx.storage.setAlarm(nextDeadline);
      return;
    }
    const reason = d.ended ? (d.endReason || "host_closed_room")
      : absoluteDeadline <= now ? "session_expired" : "host_inactive_15m";
    await this.closeAndDelete(d, reason);
  }
}

export class PairRoom extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.state = null; }
  async value() { return this.state || (this.state = await this.ctx.storage.get("state")); }
  async save(value) { this.state = value; await this.ctx.storage.put("state", value); }
  notify(value) { for (const ws of this.ctx.getWebSockets()) safeSend(ws, value); }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/create") {
      const old = await this.value(); if (old && old.expiresAt > Date.now()) return json({ ok: false, error: "Code belegt." }, 409);
      const body = await readJson(request), state = { code: body.code, pairToken: token(24), hostToken: "", claim: null, latestState: null, expiresAt: Date.now() + 15 * 60000 };
      await this.save(state); await this.ctx.storage.setAlarm(state.expiresAt);
      return json({ ok: true, code: state.code, pairToken: state.pairToken, protocolVersion: VERSION, expiresAt: state.expiresAt, pairUrl: `${body.origin}/p/${state.code}/${state.pairToken}` }, 201);
    }
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const state = await this.value();
      if (!state || state.expiresAt < Date.now()) return new Response("Pair code expired", { status: 410 });
      const supplied = clean(url.searchParams.get("token"), 240);
      if (!supplied || supplied !== state.pairToken) return new Response("Pair token invalid", { status: 403 });
      const [client, server] = Object.values(new WebSocketPair()); this.ctx.acceptWebSocket(server); server.serializeAttachment({ role: "viewer" });
      safeSend(server, { type: "PAIR_READY", code: state.code, latestState: state.latestState, claim: state.claim });
      return new Response(null, { status: 101, webSocket: client });
    }
    const state = await this.value(); if (!state || state.expiresAt < Date.now()) return json({ ok: false, error: "TV-Code abgelaufen." }, 404);
    const body = request.method === "POST" ? await readJson(request) : {};
    if (url.pathname === "/claim-qr") {
      if (clean(body.pairToken, 240) !== state.pairToken) return json({ ok: false, error: "QR-Kopplung ungültig." }, 403);
      state.hostToken = token(24); state.claim = { status: "approved", claimId: token(12), hostToken: state.hostToken }; await this.save(state); this.notify({ type: "LEGACY_CONNECTED" });
      return json({ ok: true, hostToken: state.hostToken, protocolVersion: VERSION, expiresAt: state.expiresAt });
    }
    if (url.pathname === "/request-code") {
      state.claim = { status: "pending", claimId: token(12), clientName: clean(body.clientName, 80) }; await this.save(state); this.notify({ type: "CLAIM_REQUEST", claim: state.claim });
      return json({ ok: true, claimId: state.claim.claimId, status: "pending" });
    }
    if (url.pathname === "/approve") {
      if (!state.claim || clean(body.claimId, 180) !== state.claim.claimId) return json({ ok: false, error: "Anfrage nicht gefunden." }, 404);
      state.hostToken = token(24); state.claim = { ...state.claim, status: body.approved === false ? "denied" : "approved", hostToken: body.approved === false ? "" : state.hostToken }; await this.save(state); this.notify({ type: "CLAIM_RESULT", claim: state.claim }); return json({ ok: true, status: state.claim.status });
    }
    if (url.pathname === "/claim-status") {
      if (!state.claim || clean(body.claimId, 180) !== state.claim.claimId) return json({ ok: true, status: "pending" });
      return json({ ok: true, ...state.claim, expiresAt: state.expiresAt });
    }
    if (url.pathname === "/state") {
      if (!state.hostToken || clean(body.hostToken, 240) !== state.hostToken) return json({ ok: false, error: "invalid host token" }, 403);
      state.latestState = body.state || {}; state.version = Number(body.version || 0); await this.save(state); this.notify({ type: "LEGACY_STATE", state: state.latestState, version: state.version }); return json({ ok: true, version: state.version });
    }
    if (url.pathname === "/heartbeat") {
      if (!state.hostToken || clean(body.hostToken, 240) !== state.hostToken) return json({ ok: false, error: "invalid host token" }, 403);
      return json({ ok: true, expiresAt: state.expiresAt });
    }
    if (url.pathname === "/realtime-claim") {
      if (body.pairToken && clean(body.pairToken, 240) !== state.pairToken) return json({ ok: false, error: "QR-Kopplung ungültig." }, 403);
      const descriptor = { v: 1, sessionId: clean(body.sessionId, 180), role: "tv", inviteToken: clean(body.tvInviteToken, 240), roomCode: "", localCandidates: Array.isArray(body.localCandidates) ? body.localCandidates : [], cloudBaseUrl: clean(body.cloudBaseUrl, 300) };
      if (descriptor.sessionId.length < 16 || descriptor.inviteToken.length < 16) return json({ ok: false, error: "Sitzungsdaten ungültig." }, 400);
      if (!body.pairToken) { state.claim = { status: "pending", claimId: token(12), descriptor }; await this.save(state); this.notify({ type: "REALTIME_CLAIM_REQUEST", claim: state.claim }); return json({ ok: true, status: "pending", claimId: state.claim.claimId }); }
      state.realtimeDescriptor = descriptor; await this.save(state); this.notify({ type: "REALTIME_DESCRIPTOR", descriptor }); return json({ ok: true, status: "approved" });
    }
    return json({ ok: false, error: "Nicht gefunden." }, 404);
  }
  async webSocketMessage(ws, raw) {
    try {
      const value = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      if (value?.type === "APPROVE" || value?.type === "DENY") {
        const state = await this.value(); if (!state?.claim || clean(value.claimId, 180) !== state.claim.claimId) return;
        if (state.claim.descriptor && value.type === "APPROVE") { state.realtimeDescriptor = state.claim.descriptor; state.claim.status = "approved"; await this.save(state); this.notify({ type: "REALTIME_DESCRIPTOR", descriptor: state.realtimeDescriptor }); }
        else { state.hostToken = value.type === "APPROVE" ? token(24) : ""; state.claim.status = value.type === "APPROVE" ? "approved" : "denied"; state.claim.hostToken = state.hostToken; await this.save(state); this.notify({ type: "CLAIM_RESULT", claim: state.claim }); }
      }
    } catch (_) {}
  }
  async alarm() { for (const ws of this.ctx.getWebSockets()) try { ws.close(1001, "pair expired"); } catch (_) {} await this.ctx.storage.deleteAll(); }
}

// Kompatibilitätsklasse für den bereits veröffentlichten Durable-Object-Namespace.
// Der aktuelle Hitster-Stand verwendet diesen Guard nicht mehr aktiv. Die Klasse
// muss dennoch exportiert bleiben, solange der bestehende Namespace nicht durch
// eine spätere, ausdrücklich geplante delete_class-Migration entfernt wird.
export class UsageGuard extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/check" || request.method !== "POST") {
      return json({ ok: false, error: "Nicht gefunden." }, 404);
    }

    const body = await readJson(request);
    const kind = clean(body.kind, 40);
    const limits = {
      "session-open": { day: 250, window: 50 },
      "pair-create": { day: 1000, window: 200 },
      "resolve": { day: 50_000, window: 5_000 }
    };
    const limit = limits[kind];
    if (!limit) return json({ ok: false, error: "Unbekannte Schutzoperation." }, 400);

    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const windowId = Math.floor(now / (10 * 60 * 1000));
    const state = await this.ctx.storage.get("state") || { day, daily: {}, windowId, window: {} };
    if (state.day !== day) Object.assign(state, { day, daily: {}, windowId, window: {} });
    if (state.windowId !== windowId) Object.assign(state, { windowId, window: {} });

    const daily = Number(state.daily[kind] || 0);
    const currentWindow = Number(state.window[kind] || 0);
    if (daily >= limit.day || currentWindow >= limit.window) {
      const retryAfter = currentWindow >= limit.window
        ? Math.max(1, Math.ceil(((windowId + 1) * 10 * 60 * 1000 - now) / 1000))
        : Math.max(1, Math.ceil(((Date.parse(`${day}T00:00:00Z`) + 86_400_000) - now) / 1000));
      return json({
        ok: false,
        error: "Temporäres Schutzlimit erreicht. Bitte später erneut versuchen.",
        retryAfter
      }, 429);
    }

    state.daily[kind] = daily + 1;
    state.window[kind] = currentWindow + 1;
    await this.ctx.storage.put("state", state);
    return json({
      ok: true,
      remainingDay: limit.day - state.daily[kind],
      remainingWindow: limit.window - state.window[kind]
    });
  }
}
