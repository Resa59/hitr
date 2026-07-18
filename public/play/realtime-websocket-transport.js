(function (global) {
  "use strict";

  class SocketLink {
    constructor(url, name, timeoutMs) {
      this.url = String(url);
      this.name = name;
      this.timeoutMs = timeoutMs || 8000;
      this.socket = null;
      this.onMessage = null;
      this.onClose = null;
      this.onError = null;
    }
    connect() {
      return new Promise((resolve, reject) => {
        let done = false;
        const ws = new WebSocket(this.url);
        this.socket = ws;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          try { ws.close(); } catch (_) { }
          reject(new Error(`${this.name === "local" ? "Lokale" : "Cloud"}-Verbindung hat zu lange gedauert.`));
        }, this.timeoutMs);
        ws.onopen = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
        ws.onmessage = event => this.onMessage?.(event.data, this.name);
        ws.onerror = event => {
          this.onError?.(event, this.name);
          if (!done) {
            done = true;
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
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error("WebSocket ist nicht verbunden.");
      this.socket.send(value);
      return 1;
    }
    close(code = 1000, reason = "closed") { try { this.socket?.close(code, reason); } catch (_) { } }
    get open() { return this.socket?.readyState === WebSocket.OPEN; }
  }

  class CloudFirstRealtimeTransport {
    constructor(descriptor, options = {}) {
      this.descriptor = descriptor;
      this.role = options.role || descriptor.role || "player";
      this.localPath = options.localPath || (this.role === "tv" ? "/tv/" : "/client/");
      this.connectTimeoutMs = Number(options.connectTimeoutMs || 9000);
      this.links = { cloud: null, local: null };
      this.active = null;
      this.onMessage = null;
      this.onClose = null;
      this.onError = null;
      this.onOpen = null;
      this.onTransport = null;
      this.onCloudSelected = null;
      this.onBeforeLocalSwitch = null;
      this.userClosed = false;
      this.probeTimer = null;
      this.connecting = new Set();
      this.selectionPending = false;
      this.cloudConfirmed = false;
    }

    cloudWsUrl() {
      const base = String(this.descriptor.cloudBaseUrl || location.origin).replace(/\/$/, "");
      return `${base.replace(/^http/i, "ws")}/api/realtime/ws?sid=${encodeURIComponent(this.descriptor.sessionId)}`;
    }
    currentLocalBase() {
      const origin = location.origin;
      return (this.descriptor.localCandidates || []).find(base => {
        try { return new URL(base).origin === origin; } catch (_) { return false; }
      }) || "";
    }
    localWsUrl(base) {
      return `${String(base).replace(/\/$/, "").replace(/^http/i, "ws")}/api/realtime/ws?sid=${encodeURIComponent(this.descriptor.sessionId)}`;
    }

    async connect() {
      this.userClosed = false;
      this.cloudConfirmed = false;
      const localBase = this.currentLocalBase();
      if (localBase) {
        try { await this.openLink("local", this.localWsUrl(localBase)); return; }
        catch (error) { this.onError?.(error); }
      }
      // Die Cloud-Verbindung authentifiziert und vermittelt zunächst nur.
      // Spielzustände werden erst nach der Transportauswahl freigegeben.
      await this.openLink("cloud", this.cloudWsUrl());
    }

    async openLink(name, url) {
      if (this.connecting.has(name) || this.links[name]?.open) return;
      this.connecting.add(name);
      try {
        const link = new SocketLink(url, name, this.connectTimeoutMs);
        this.links[name] = link;
        link.onMessage = (raw, transport) => this.onMessage?.(raw, transport);
        link.onError = error => this.onError?.(error);
        link.onClose = (info, transport) => this.linkClosed(transport, info);
        await link.connect();
        this.active = name;
        this.onTransport?.(name, "socket-open");
        this.onOpen?.(name);
      } finally {
        this.connecting.delete(name);
      }
    }

    confirmWelcome(name, payload = {}) {
      this.active = name;
      if (Array.isArray(payload.localCandidates) && payload.localCandidates.length) {
        this.descriptor.localCandidates = payload.localCandidates;
      }
      if (name === "local") {
        this.cloudConfirmed = false;
        this.onTransport?.("local", "welcome");
        if (this.links.cloud) {
          this.links.cloud.close(1000, "local-selected");
          this.links.cloud = null;
        }
        return;
      }
      this.onTransport?.("cloud", "bootstrap");
      if (!this.selectionPending) {
        this.selectionPending = true;
        this.probeLocal(true)
          .catch(error => { this.onError?.(error); return this.selectCloud(); })
          .finally(() => { this.selectionPending = false; });
      }
    }

    confirmTransport(name) {
      if (name !== "cloud") return;
      this.active = "cloud";
      this.cloudConfirmed = true;
      this.onTransport?.("cloud", "welcome");
      this.scheduleLocalProbe(30000);
    }

    async selectCloud() {
      if (this.userClosed || !this.links.cloud?.open) return false;
      this.onTransport?.("cloud", "selecting");
      await Promise.resolve(this.onCloudSelected?.());
      return true;
    }

    scheduleLocalProbe(delay = 30000) {
      clearTimeout(this.probeTimer);
      if (this.userClosed || !this.cloudConfirmed || !Array.isArray(this.descriptor.localCandidates) || !this.descriptor.localCandidates.length) return;
      this.probeTimer = setTimeout(() => this.probeLocal(false).catch(() => { }), delay);
    }

    async probeCandidate(candidate) {
      const base = String(candidate).replace(/\/$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      try {
        const response = await fetch(`${base}/api/realtime/bootstrap?sid=${encodeURIComponent(this.descriptor.sessionId)}`, {
          cache: "no-store", mode: "cors", signal: controller.signal
        });
        if (!response.ok) return null;
        const data = await response.json();
        const target = this.role === "tv" ? data.tvUrl : data.clientUrl;
        return target ? String(target) : null;
      } catch (_) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    async probeLocal(initial = false) {
      if (this.userClosed || this.active === "local") return true;
      const candidates = [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))].slice(0, 8);
      if (!candidates.length) {
        if (initial) await this.selectCloud();
        return false;
      }
      this.onTransport?.("local", "probing");
      const results = await Promise.all(candidates.map(candidate => this.probeCandidate(candidate)));
      const target = results.find(Boolean);
      if (!target) {
        if (initial) await this.selectCloud();
        else this.scheduleLocalProbe(30000);
        return false;
      }
      const url = new URL(target);
      const current = new URL(location.href);
      url.hash = current.hash;
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));
      const handoff = global.HitsterRealtimeHandoff?.() || null;
      if (handoff) {
        if (handoff.participantId) params.set("pid", handoff.participantId);
        if (handoff.resumeToken) params.set("resume", handoff.resumeToken);
        if (handoff.lastSequence) params.set("seq", String(handoff.lastSequence));
        if (handoff.displayName) params.set("name", handoff.displayName);
      }
      params.set("via", "local");
      url.hash = params.toString();
      this.onTransport?.("local", "switching");
      try { await Promise.resolve(this.onBeforeLocalSwitch?.()); } catch (_) { }
      await new Promise(resolve => setTimeout(resolve, 60));
      location.replace(url.toString());
      return true;
    }

    async linkClosed(name, info) {
      if (this.userClosed) return;
      if (this.links[name] && !this.links[name].open) this.links[name] = null;
      if (name !== this.active) return;
      this.active = null;
      this.cloudConfirmed = false;
      this.onClose?.({ ...info, transport: name, user: false });
      if (name === "local") {
        try { await this.openLink("cloud", this.cloudWsUrl()); }
        catch (error) { this.onError?.(error); }
      }
    }

    send(value) {
      const link = this.links[this.active];
      if (!link?.open) throw new Error("Keine aktive Verbindung.");
      return link.send(value);
    }

    async close(code = 1000, reason = "client closed") {
      this.userClosed = true;
      this.cloudConfirmed = false;
      clearTimeout(this.probeTimer);
      for (const link of Object.values(this.links)) link?.close(code, reason);
      this.links = { cloud: null, local: null };
      this.active = null;
    }
  }

  global.RealtimeWebSocketTransport = SocketLink;
  global.CloudFirstRealtimeTransport = CloudFirstRealtimeTransport;
})(window);
