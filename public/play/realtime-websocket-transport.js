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
      this.handshakeTimer = null;
      this.localHandoffTimer = null;
      this.connecting = new Set();
      this.selectionPending = false;
      this.cloudConfirmed = false;
      this.onDiagnostic = null;
      this.diagnosticHistory = [];
    }

    diagnostic(stage, detail = {}) {
      const entry = {
        time: Date.now(),
        stage: String(stage || "unknown"),
        role: this.role,
        active: this.active || "",
        pageOrigin: location.origin,
        ...detail
      };
      this.diagnosticHistory.push(entry);
      if (this.diagnosticHistory.length > 80) this.diagnosticHistory.splice(0, this.diagnosticHistory.length - 80);
      try { this.onDiagnostic?.(entry); } catch (_) { }
      return entry;
    }

    getDiagnostics() { return this.diagnosticHistory.map(entry => ({ ...entry })); }

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
    isLoopbackBase(base) {
      try {
        const host = new URL(String(base)).hostname.toLowerCase();
        return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
      } catch (_) { return false; }
    }
    async tryInitialLoopbackHandoff() {
      const loopback = (this.descriptor.localCandidates || []).find(base => this.isLoopbackBase(base));
      if (!loopback || this.currentLocalBase()) return false;
      this.diagnostic("loopback_probe_requested", { candidate: String(loopback) });
      const target = await this.probeCandidate(loopback, 750);
      if (!target || this.userClosed) return false;
      this.diagnostic("loopback_target_found", { target: String(target) });
      this.onTransport?.("local", "switching");
      try { this.navigateToLocalTarget(target, false); }
      catch (error) { this.onError?.(error); return false; }
      // Bei erfolgreicher Navigation wird dieser JavaScript-Kontext verworfen.
      // Falls ein Browser die Navigation blockiert, geht es nach kurzer Frist über Cloud weiter.
      await new Promise(resolve => setTimeout(resolve, 900));
      return false;
    }

    async connect() {
      this.userClosed = false;
      this.cloudConfirmed = false;
      this.diagnostic("connect_start", {
        protocol: location.protocol,
        candidates: [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))].slice(0, 8),
        hasSession: !!this.descriptor.sessionId,
        hasInvite: !!this.descriptor.inviteToken
      });
      const localBase = this.currentLocalBase();
      if (localBase) {
        this.diagnostic("already_on_local_origin", { localBase });
        try { await this.openLink("local", this.localWsUrl(localBase)); return; }
        catch (error) { this.diagnostic("local_socket_open_failed", { error: error?.message || String(error) }); this.onError?.(error); }
      }
      await this.tryInitialLoopbackHandoff();
      if (this.userClosed) return;
      // Die Cloud-Verbindung authentifiziert und vermittelt zunächst nur.
      // Spielzustände werden erst nach der Transportauswahl freigegeben.
      this.diagnostic("cloud_socket_requested", { cloudOrigin: String(this.descriptor.cloudBaseUrl || location.origin).replace(/\/$/, "") });
      await this.openLink("cloud", this.cloudWsUrl());
    }

    async openLink(name, url) {
      if (this.connecting.has(name) || this.links[name]?.open) return;
      this.connecting.add(name);
      this.diagnostic("socket_open_start", { transport: name });
      try {
        const link = new SocketLink(url, name, this.connectTimeoutMs);
        this.links[name] = link;
        link.onMessage = (raw, transport) => this.onMessage?.(raw, transport);
        link.onError = error => this.onError?.(error);
        link.onClose = (info, transport) => this.linkClosed(transport, info);
        await link.connect();
        this.active = name;
        this.diagnostic("socket_open", { transport: name });
        this.armHandshakeTimeout(name, "Der Server hat die Verbindung nicht bestätigt.");
        this.onTransport?.(name, "socket-open");
        this.onOpen?.(name);
      } finally {
        this.connecting.delete(name);
      }
    }

    armHandshakeTimeout(name, detail) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = setTimeout(() => {
        if (this.userClosed) return;
        const error = new Error(detail || "Verbindungsbestätigung hat zu lange gedauert.");
        this.diagnostic("handshake_timeout", { transport: name, error: error.message });
        this.onError?.(error);
        try { this.links[name]?.close(4008, "handshake-timeout"); } catch (_) { }
      }, name === "local" ? 4500 : 18000);
    }

    clearHandshakeTimeout() {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }

    confirmWelcome(name, payload = {}) {
      this.active = name;
      if (Array.isArray(payload.localCandidates) && payload.localCandidates.length) {
        this.descriptor.localCandidates = payload.localCandidates;
      }
      this.diagnostic("welcome", { transport: name, candidates: [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))].slice(0, 8) });
      if (name === "local") {
        this.clearHandshakeTimeout();
        this.cloudConfirmed = false;
        this.onTransport?.("local", "welcome");
        if (this.links.cloud) {
          this.links.cloud.close(1000, "local-selected");
          this.links.cloud = null;
        }
        return;
      }
      this.onTransport?.("cloud", "bootstrap");
      this.armHandshakeTimeout("cloud", "Cloudflare hat die Transportauswahl nicht bestätigt. Bitte den aktuellen Worker deployen.");
      if (!this.selectionPending) {
        this.selectionPending = true;
        this.probeLocal(true)
          .catch(error => { this.onError?.(error); return this.selectCloud(); })
          .finally(() => { this.selectionPending = false; });
      }
    }

    confirmTransport(name) {
      if (name !== "cloud") return;
      this.clearHandshakeTimeout();
      clearTimeout(this.localHandoffTimer);
      this.localHandoffTimer = null;
      this.active = "cloud";
      this.cloudConfirmed = true;
      this.diagnostic("transport_confirmed", { transport: "cloud" });
      this.onTransport?.("cloud", "welcome");
      this.scheduleLocalProbe(30000);
    }

    async selectCloud() {
      if (this.userClosed || !this.links.cloud?.open) return false;
      this.onTransport?.("cloud", "selecting");
      this.diagnostic("cloud_fallback_selected", { reason: "local_unavailable_or_blocked" });
      await Promise.resolve(this.onCloudSelected?.());
      return true;
    }

    scheduleLocalProbe(delay = 30000) {
      clearTimeout(this.probeTimer);
      if (this.userClosed || !this.cloudConfirmed || !Array.isArray(this.descriptor.localCandidates) || !this.descriptor.localCandidates.length) return;
      this.probeTimer = setTimeout(() => this.probeLocal(false).catch(() => { }), delay);
    }

    async probeCandidate(candidate, timeoutMs = 1800) {
      const base = String(candidate).replace(/\/$/, "");
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      this.diagnostic("local_probe_start", { candidate: base, timeoutMs });
      try {
        const requestOptions = { cache: "no-store", mode: "cors", signal: controller.signal };
        try { requestOptions.targetAddressSpace = "local"; } catch (_) { }
        const response = await fetch(`${base}/api/realtime/bootstrap?sid=${encodeURIComponent(this.descriptor.sessionId)}`, requestOptions);
        if (!response.ok) {
          let serverError = "";
          try { serverError = String((await response.json())?.error || ""); } catch (_) { }
          this.diagnostic("local_probe_http_rejected", { candidate: base, status: response.status, serverError, durationMs: Date.now() - started });
          return null;
        }
        const data = await response.json();
        const target = this.role === "tv" ? data.tvUrl : data.clientUrl;
        this.diagnostic("local_probe_success", { candidate: base, target: target ? String(target) : "", durationMs: Date.now() - started });
        return target ? String(target) : null;
      } catch (error) {
        this.diagnostic("local_probe_failed", {
          candidate: base,
          errorName: error?.name || "Error",
          error: error?.message || String(error),
          durationMs: Date.now() - started,
          pageProtocol: location.protocol
        });
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    navigateToLocalTarget(target, includeHandoff = true) {
      const url = new URL(target);
      const current = new URL(location.href);
      url.hash = current.hash;
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));

      // Bei manueller Raumcode-Eingabe existiert der aufgelöste Descriptor nur
      // im Arbeitsspeicher der Cloud-Seite. Ohne diese Felder verliert die
      // lokale Zielseite Session-ID, Einladungstoken und Raumcode.
      const descriptor = this.descriptor || {};
      if (descriptor.sessionId) params.set("sid", String(descriptor.sessionId));
      if (descriptor.role || this.role) params.set("role", String(descriptor.role || this.role));
      if (descriptor.inviteToken) params.set("invite", String(descriptor.inviteToken));
      if (descriptor.roomCode) params.set("code", String(descriptor.roomCode).toUpperCase());
      if (descriptor.cloudBaseUrl) params.set("cloud", String(descriptor.cloudBaseUrl));
      if (descriptor.expiresAt) params.set("exp", String(descriptor.expiresAt));
      params.set("v", String(descriptor.v || global.HitsterRealtimeProtocol?.VERSION || 1));
      params.delete("local");
      for (const local of Array.isArray(descriptor.localCandidates) ? descriptor.localCandidates : []) {
        if (local) params.append("local", String(local));
      }

      if (includeHandoff) {
        const handoff = global.HitsterRealtimeHandoff?.() || null;
        if (handoff) {
          if (handoff.participantId) params.set("pid", handoff.participantId);
          if (handoff.resumeToken) params.set("resume", handoff.resumeToken);
          if (handoff.lastSequence) params.set("seq", String(handoff.lastSequence));
          if (handoff.displayName) params.set("name", handoff.displayName);
        }
      }
      params.set("via", "local");
      url.hash = params.toString();
      this.diagnostic("local_navigation", { targetOrigin: url.origin, targetPath: url.pathname, handoff: !!includeHandoff });
      location.replace(url.toString());
    }

    async probeLocal(initial = false) {
      if (this.userClosed || this.active === "local") return true;
      const candidates = [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))].slice(0, 8);
      if (!candidates.length) {
        this.diagnostic("local_probe_skipped", { reason: "no_candidates", initial: !!initial });
        if (initial) await this.selectCloud();
        return false;
      }
      this.onTransport?.("local", "probing");
      this.diagnostic("local_probe_batch", { initial: !!initial, candidates });
      const results = await Promise.all(candidates.map(candidate => this.probeCandidate(candidate)));
      const target = results.find(Boolean);
      if (!target) {
        this.diagnostic("local_probe_batch_failed", { initial: !!initial, candidates });
        if (initial) await this.selectCloud();
        else this.scheduleLocalProbe(30000);
        return false;
      }
      this.diagnostic("local_probe_batch_success", { target: String(target), initial: !!initial });
      this.onTransport?.("local", "switching");
      // Cloud bleibt bis zum tatsächlich geladenen lokalen Ziel unangetastet.
      // Falls Android/der Browser die private HTTP-Navigation blockiert, wählt
      // diese Seite nach kurzer Frist automatisch wieder die funktionierende Cloud.
      clearTimeout(this.localHandoffTimer);
      this.localHandoffTimer = setTimeout(() => {
        if (this.userClosed || this.active !== "cloud" || this.cloudConfirmed) return;
        this.onError?.(new Error("Der Wechsel ins lokale WLAN wurde blockiert. Die Cloud-Verbindung wird verwendet."));
        this.selectCloud().catch(error => this.onError?.(error));
      }, 2800);
      try {
        this.navigateToLocalTarget(target, true);
      } catch (error) {
        clearTimeout(this.localHandoffTimer);
        await this.selectCloud();
        this.onError?.(error);
        return false;
      }
      return true;
    }

    async linkClosed(name, info) {
      if (this.userClosed) return;
      if (this.links[name] && !this.links[name].open) this.links[name] = null;
      if (name !== this.active) return;
      this.active = null;
      this.cloudConfirmed = false;
      this.clearHandshakeTimeout();
      this.diagnostic("socket_closed", { transport: name, code: Number(info?.code || 0), reason: String(info?.reason || ""), clean: !!info?.clean });
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
      this.diagnostic("transport_close", { code, reason });
      this.userClosed = true;
      this.cloudConfirmed = false;
      clearTimeout(this.probeTimer);
      clearTimeout(this.localHandoffTimer);
      this.localHandoffTimer = null;
      this.clearHandshakeTimeout();
      for (const link of Object.values(this.links)) link?.close(code, reason);
      this.links = { cloud: null, local: null };
      this.active = null;
    }
  }

  global.RealtimeWebSocketTransport = SocketLink;
  global.CloudFirstRealtimeTransport = CloudFirstRealtimeTransport;
})(window);
