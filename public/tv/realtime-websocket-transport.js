(function (global) {
  "use strict";

  class SocketLink {
    constructor(url, name, timeoutMs) {
      this.url = String(url);
      this.name = name;
      this.timeoutMs = Number(timeoutMs || 8000);
      this.socket = null;
      this.onMessage = null;
      this.onClose = null;
      this.onError = null;
    }
    connect() {
      return new Promise((resolve, reject) => {
        let settled = false;
        const ws = new WebSocket(this.url);
        this.socket = ws;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { ws.close(); } catch (_) { }
          reject(new Error(`${this.name === "local" ? "Lokale" : "Cloud"}-Verbindung hat zu lange gedauert.`));
        }, this.timeoutMs);
        ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        ws.onmessage = event => this.onMessage?.(event.data, this.name);
        ws.onerror = event => {
          this.onError?.(event, this.name);
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(`${this.name === "local" ? "Lokale" : "Cloud"}-Verbindung fehlgeschlagen.`));
          }
        };
        ws.onclose = event => {
          clearTimeout(timer);
          this.onClose?.({ code: event.code, reason: event.reason, clean: event.wasClean }, this.name);
        };
      });
    }
    send(value) {
      if (!this.open) throw new Error(`${this.name === "local" ? "Lokale" : "Cloud"}-Verbindung ist nicht geöffnet.`);
      this.socket.send(value);
      return 1;
    }
    close(code = 1000, reason = "closed") { try { this.socket?.close(code, reason); } catch (_) { } }
    get open() { return this.socket?.readyState === WebSocket.OPEN; }
  }

  class CloudFirstRealtimeTransport {
    constructor(descriptor, options = {}) {
      this.descriptor = descriptor || {};
      this.role = options.role || descriptor?.role || "player";
      this.connectTimeoutMs = Number(options.connectTimeoutMs || 9000);
      this.links = { cloud: null, local: null };
      this.cloudConnected = false;
      this.localConnected = false;
      this.cloudConfirmed = false;
      this.localConfirmed = false;
      this.preferredDataPath = "cloud";
      this.active = null; // Kompatibilitätsanzeige: bevorzugter Datenweg.
      this.onMessage = null;
      this.onClose = null;
      this.onError = null;
      this.onOpen = null;
      this.onTransport = null;
      this.onCloudSelected = null;
      this.onLocalUnavailable = null;
      this.userClosed = false;
      this.connecting = new Set();
      this.handshakeTimers = { cloud: null, local: null };
      this.localProbeTimer = null;
      this.cloudReconnectTimer = null;
      this.cloudReconnectAttempt = 0;
      this.pendingLocal = new Map();
      this.onDiagnostic = null;
      this.diagnosticHistory = [];
      this.localAckTimeoutMs = Math.max(250, Number(options.localAckTimeoutMs || 850));
    }

    diagnostic(stage, detail = {}) {
      const entry = {
        time: Date.now(), stage: String(stage || "unknown"), role: this.role,
        active: this.active || "", preferredDataPath: this.preferredDataPath,
        cloudConnected: !!this.cloudConnected, localConnected: !!this.localConnected,
        pageOrigin: location.origin, ...detail
      };
      this.diagnosticHistory.push(entry);
      if (this.diagnosticHistory.length > 100) this.diagnosticHistory.splice(0, this.diagnosticHistory.length - 100);
      try { this.onDiagnostic?.(entry); } catch (_) { }
      return entry;
    }
    getDiagnostics() { return this.diagnosticHistory.map(entry => ({ ...entry })); }
    state() {
      return {
        cloudConnected: !!this.cloudConnected,
        localConnected: !!this.localConnected,
        preferredDataPath: this.preferredDataPath,
        active: this.active || ""
      };
    }

    cloudWsUrl() {
      const base = String(this.descriptor.cloudBaseUrl || location.origin).replace(/\/$/, "");
      return `${base.replace(/^http/i, "ws")}/api/realtime/ws?sid=${encodeURIComponent(this.descriptor.sessionId)}`;
    }
    isLoopbackBase(base) {
      try {
        const host = new URL(String(base)).hostname.toLowerCase().replace(/^\[|\]$/g, "");
        return host === "127.0.0.1" || host === "localhost" || host === "::1";
      } catch (_) { return false; }
    }
    usableCandidates() {
      return [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))]
        .filter(base => !this.isLoopbackBase(base)).slice(0, 8);
    }
    updateLocalCandidates(candidates, source = "cloud") {
      const next = [...new Set((Array.isArray(candidates) ? candidates : []).map(String).filter(Boolean))]
        .filter(base => !this.isLoopbackBase(base)).slice(0, 8);
      const before = JSON.stringify(this.usableCandidates());
      this.descriptor.localCandidates = next;
      this.diagnostic("local_candidates_updated", { source, candidates: next, changed: before !== JSON.stringify(next) });
      if (before !== JSON.stringify(next) && this.cloudConfirmed && !this.localConfirmed) this.scheduleLocalProbe(80);
      return next;
    }

    async connect() {
      this.userClosed = false;
      this.diagnostic("connect_start", {
        protocol: location.protocol,
        candidates: this.usableCandidates(),
        loopbackIgnored: (this.descriptor.localCandidates || []).some(base => this.isLoopbackBase(base)),
        hasSession: !!this.descriptor.sessionId,
        hasInvite: !!this.descriptor.inviteToken
      });
      await this.openLink("cloud", this.cloudWsUrl());
    }

    async openLink(name, url) {
      if (this.userClosed || this.connecting.has(name) || this.links[name]?.open) return false;
      this.connecting.add(name);
      this.diagnostic("socket_open_start", { transport: name, url: name === "local" ? String(url).replace(/\?.*$/, "") : undefined });
      try {
        const link = new SocketLink(url, name, this.connectTimeoutMs);
        this.links[name] = link;
        link.onMessage = (raw, transport) => this.receive(raw, transport);
        link.onError = error => this.onError?.(error);
        link.onClose = (info, transport) => this.linkClosed(transport, info);
        await link.connect();
        if (this.userClosed) { link.close(); return false; }
        if (name === "cloud") this.cloudConnected = true;
        else this.localConnected = true;
        this.updateActive();
        this.diagnostic("socket_open", { transport: name });
        this.armHandshakeTimeout(name);
        this.onTransport?.(name, "socket-open", this.state());
        this.onOpen?.(name);
        return true;
      } finally {
        this.connecting.delete(name);
      }
    }

    receive(raw, transport) {
      let parsed = null;
      try { parsed = JSON.parse(String(raw)); } catch (_) { }
      if (transport === "local" && parsed?.type === "ACK") {
        const replyTo = String(parsed.payload?.replyTo || "");
        const pending = this.pendingLocal.get(replyTo);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingLocal.delete(replyTo);
          this.diagnostic("local_delivery_ack", { messageId: replyTo, type: pending.type, durationMs: Date.now() - pending.startedAt });
        }
        return;
      }
      if (transport === "cloud" && parsed?.type === "LOCAL_CANDIDATES") {
        this.updateLocalCandidates(parsed.payload?.localCandidates || [], "cloud-event");
        return;
      }
      this.onMessage?.(raw, transport);
      if (transport === "local") this.acknowledgeHostMessage(parsed);
    }

    acknowledgeHostMessage(message) {
      if (!message || message.sender?.role !== "host" || !message.messageId || !this.links.local?.open) return false;
      const ignored = new Set(["ACK", "WELCOME", "PONG", "PRESENCE", "LOCAL_CANDIDATES", "TRANSPORT_CONFIRMED"]);
      if (ignored.has(String(message.type || ""))) return false;
      try {
        const protocol = global.HitsterRealtimeProtocol;
        if (!protocol?.envelope || !this.descriptor?.sessionId) return false;
        const ack = protocol.envelope("ACK", this.descriptor.sessionId, {
          replyTo: String(message.messageId)
        }, {
          sender: { role: this.role, id: this.descriptor.participantId || "" },
          target: { role: "host", participantId: null }
        });
        this.links.local.send(JSON.stringify(ack));
        this.diagnostic("local_host_delivery_ack_sent", { messageId: message.messageId, type: message.type });
        return true;
      } catch (error) {
        this.diagnostic("local_host_delivery_ack_failed", { messageId: message.messageId, type: message.type, error: error?.message || String(error) });
        return false;
      }
    }

    armHandshakeTimeout(name) {
      this.clearHandshakeTimeout(name);
      this.handshakeTimers[name] = setTimeout(() => {
        if (this.userClosed) return;
        const confirmed = name === "cloud" ? this.cloudConfirmed : this.localConfirmed;
        if (confirmed) return;
        const error = new Error(`${name === "local" ? "Lokaler Datenkanal" : "Cloud-Verbindung"} wurde nicht bestätigt.`);
        this.diagnostic("handshake_timeout", { transport: name, error: error.message });
        try { this.links[name]?.close(4008, "handshake-timeout"); } catch (_) { }
        if (name === "cloud") this.onError?.(error);
      }, name === "local" ? 5000 : 18000);
    }
    clearHandshakeTimeout(name) {
      clearTimeout(this.handshakeTimers[name]);
      this.handshakeTimers[name] = null;
    }

    confirmWelcome(name, payload = {}) {
      if (Array.isArray(payload.localCandidates)) this.updateLocalCandidates(payload.localCandidates, `${name}-welcome`);
      this.clearHandshakeTimeout(name);
      this.diagnostic("welcome", { transport: name, candidates: this.usableCandidates() });
      if (name === "local") {
        this.localConnected = true;
        this.localConfirmed = true;
        this.preferredDataPath = "local";
        this.updateActive();
        this.cloudReconnectAttempt = 0;
        this.onTransport?.("local", "welcome", this.state());
        return;
      }
      this.cloudConnected = true;
      this.cloudReconnectAttempt = 0;
      this.onTransport?.("cloud", "bootstrap", this.state());
      try { this.onCloudSelected?.(); }
      catch (error) { this.onError?.(error); }
    }

    confirmTransport(name) {
      if (name !== "cloud") return;
      this.clearHandshakeTimeout("cloud");
      this.cloudConnected = true;
      this.cloudConfirmed = true;
      if (!this.localConfirmed) this.preferredDataPath = "cloud";
      this.updateActive();
      this.diagnostic("transport_confirmed", { transport: "cloud" });
      this.onTransport?.("cloud", "welcome", this.state());
      this.scheduleLocalProbe(80);
    }

    updateActive() {
      this.preferredDataPath = this.localConfirmed && this.links.local?.open ? "local" : "cloud";
      this.active = this.preferredDataPath === "local" ? "local" : (this.links.cloud?.open ? "cloud" : null);
    }

    scheduleLocalProbe(delay = 30000) {
      clearTimeout(this.localProbeTimer);
      if (this.userClosed || !this.cloudConfirmed || this.localConfirmed || !this.usableCandidates().length) return;
      this.localProbeTimer = setTimeout(() => this.probeLocal(false).catch(error => this.onError?.(error)), Math.max(0, delay));
    }

    async probeCandidate(candidate, timeoutMs = 2400) {
      const base = String(candidate).replace(/\/$/, "");
      if (this.isLoopbackBase(base)) return null;
      const endpoint = `${base}/api/realtime/bootstrap?sid=${encodeURIComponent(this.descriptor.sessionId)}&t=${Date.now()}`;
      const started = Date.now();
      this.diagnostic("local_probe_start", { candidate: base, timeoutMs, addressSpace: "local" });
      for (const includeAddressSpace of [true, false]) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const options = { cache: "no-store", mode: "cors", credentials: "omit", redirect: "error", signal: controller.signal };
          if (includeAddressSpace) options.targetAddressSpace = "local";
          const response = await fetch(endpoint, options);
          if (!response.ok) {
            let serverError = "";
            try { serverError = String((await response.json())?.error || ""); } catch (_) { }
            this.diagnostic("local_probe_http_rejected", { candidate: base, status: response.status, serverError, includeAddressSpace, durationMs: Date.now() - started });
            continue;
          }
          const data = await response.json();
          const wsUrl = String(data.wsUrl || "");
          if (wsUrl) {
            this.diagnostic("local_probe_success", { candidate: base, wsUrl: wsUrl.replace(/\?.*$/, ""), includeAddressSpace, durationMs: Date.now() - started });
            return { base, wsUrl };
          }
          this.diagnostic("local_probe_invalid_response", { candidate: base, includeAddressSpace });
        } catch (error) {
          this.diagnostic("local_probe_failed", { candidate: base, includeAddressSpace, errorName: error?.name || "Error", error: error?.message || String(error), durationMs: Date.now() - started, pageProtocol: location.protocol });
        } finally { clearTimeout(timer); }
      }
      return null;
    }

    async probeLocal(initial = false) {
      if (this.userClosed || this.localConfirmed || this.links.local?.open) return true;
      const candidates = this.usableCandidates();
      if (!candidates.length) {
        this.diagnostic("local_probe_skipped", { reason: "no_lan_candidates", initial: !!initial });
        this.onLocalUnavailable?.({ candidates: [], manual: false });
        return false;
      }
      this.onTransport?.("local", "probing", this.state());
      this.diagnostic("local_probe_batch", { initial: !!initial, candidates });
      for (const candidate of candidates) {
        const result = await this.probeCandidate(candidate);
        if (!result) continue;
        try {
          await this.openLink("local", result.wsUrl);
          return true;
        } catch (error) {
          this.diagnostic("local_socket_open_failed", { candidate, error: error?.message || String(error) });
        }
      }
      this.diagnostic("local_probe_batch_failed", { initial: !!initial, candidates });
      this.onTransport?.("cloud", "local-unavailable", this.state());
      this.onLocalUnavailable?.({ candidates, manual: false });
      this.scheduleLocalProbe(30000);
      return false;
    }

    async retryLocal() {
      if (this.userClosed) return false;
      if (this.localConfirmed) return true;
      clearTimeout(this.localProbeTimer);
      const ok = await this.probeLocal(false);
      if (!ok) throw new Error("Der lokale Datenkanal ist nicht erreichbar. Die Cloud-Verbindung bleibt aktiv.");
      return true;
    }

    sendVia(name, value) {
      const link = this.links[name];
      if (!link?.open) throw new Error(`${name === "local" ? "Lokaler Datenkanal" : "Cloud-Verbindung"} ist nicht geöffnet.`);
      return link.send(value);
    }

    messageInfo(value) {
      try {
        const parsed = JSON.parse(String(value));
        return { type: String(parsed.type || ""), messageId: String(parsed.messageId || "") };
      } catch (_) { return { type: "", messageId: "" }; }
    }

    send(value, options = {}) {
      const info = this.messageInfo(value);
      const localPreferredTypes = new Set(["ANSWER_SUBMITTED", "SCORE_CONFIRMED"]);
      const mayUseLocal = options.transport !== "cloud" && localPreferredTypes.has(info.type) && this.localConfirmed && this.links.local?.open;
      if (mayUseLocal) {
        try {
          this.links.local.send(value);
          if (info.messageId) {
            const timer = setTimeout(() => this.fallbackPending(info.messageId, "ack-timeout"), this.localAckTimeoutMs);
            this.pendingLocal.set(info.messageId, { raw: String(value), type: info.type, timer, startedAt: Date.now() });
          }
          this.diagnostic("local_delivery_sent", { type: info.type, messageId: info.messageId });
          return 1;
        } catch (error) {
          this.diagnostic("local_delivery_send_failed", { type: info.type, error: error?.message || String(error) });
        }
      }
      return this.sendVia("cloud", value);
    }

    fallbackPending(messageId, reason) {
      const pending = this.pendingLocal.get(messageId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pendingLocal.delete(messageId);
      try {
        this.sendVia("cloud", pending.raw);
        this.diagnostic("local_delivery_cloud_fallback", { messageId, type: pending.type, reason });
      } catch (error) {
        this.diagnostic("local_delivery_fallback_failed", { messageId, type: pending.type, reason, error: error?.message || String(error) });
        this.onError?.(error);
      }
    }
    fallbackAllPending(reason) { for (const id of [...this.pendingLocal.keys()]) this.fallbackPending(id, reason); }

    async linkClosed(name, info) {
      if (this.userClosed) return;
      if (this.links[name] && !this.links[name].open) this.links[name] = null;
      this.clearHandshakeTimeout(name);
      this.diagnostic("socket_closed", { transport: name, code: Number(info?.code || 0), reason: String(info?.reason || ""), clean: !!info?.clean });
      if (name === "local") {
        this.localConnected = false;
        this.localConfirmed = false;
        this.fallbackAllPending("local-socket-closed");
        this.updateActive();
        this.onTransport?.("cloud", "fallback", this.state());
        this.scheduleLocalProbe(5000);
        return;
      }
      this.cloudConnected = false;
      this.cloudConfirmed = false;
      this.updateActive();
      this.onTransport?.("cloud", "reconnecting", this.state());
      this.scheduleCloudReconnect();
      if (!this.localConfirmed) this.onClose?.({ ...info, transport: "cloud", user: false, reconnecting: true });
    }

    scheduleCloudReconnect() {
      clearTimeout(this.cloudReconnectTimer);
      if (this.userClosed || this.links.cloud?.open || this.connecting.has("cloud")) return;
      const delay = Math.min(15000, 700 * Math.pow(1.7, Math.min(this.cloudReconnectAttempt++, 8)));
      this.diagnostic("cloud_reconnect_scheduled", { delayMs: Math.round(delay) });
      this.cloudReconnectTimer = setTimeout(async () => {
        try { await this.openLink("cloud", this.cloudWsUrl()); }
        catch (error) { this.onError?.(error); this.scheduleCloudReconnect(); }
      }, delay);
    }

    async close(code = 1000, reason = "client closed") {
      this.diagnostic("transport_close", { code, reason });
      this.userClosed = true;
      clearTimeout(this.localProbeTimer);
      clearTimeout(this.cloudReconnectTimer);
      this.fallbackAllPending("transport-closing");
      for (const name of ["cloud", "local"]) {
        this.clearHandshakeTimeout(name);
        this.links[name]?.close(code, reason);
      }
      this.links = { cloud: null, local: null };
      this.cloudConnected = false;
      this.localConnected = false;
      this.cloudConfirmed = false;
      this.localConfirmed = false;
      this.preferredDataPath = "cloud";
      this.active = null;
    }
  }

  global.RealtimeWebSocketTransport = SocketLink;
  global.CloudFirstRealtimeTransport = CloudFirstRealtimeTransport;
})(window);
