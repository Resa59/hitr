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
      this.onLocalUnavailable = null;
      this.canSwitchLocal = typeof options.canSwitchLocal === "function" ? options.canSwitchLocal : (() => true);
      this.userClosed = false;
      this.probeTimer = null;
      this.handshakeTimer = null;
      this.localHandoffTimer = null;
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
    isLoopbackBase(base) {
      try {
        const host = new URL(String(base)).hostname.toLowerCase();
        return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
      } catch (_) { return false; }
    }
    orderedCandidates() {
      const values = [...new Set((this.descriptor.localCandidates || []).map(String).filter(Boolean))].slice(0, 8);
      const pageIsLoopback = this.isLoopbackBase(location.origin);
      return values.sort((a, b) => {
        const al = this.isLoopbackBase(a), bl = this.isLoopbackBase(b);
        if (al === bl) return 0;
        // Auf einer Cloud-Seite zuerst die LAN-Adresse prüfen. Auf einer bereits
        // lokalen Seite bleibt Loopback der bevorzugte Same-Device-Weg.
        return pageIsLoopback ? (al ? -1 : 1) : (al ? 1 : -1);
      });
    }
    directTarget(base) {
      const root = String(base || "").replace(/\/$/, "");
      return root ? `${root}${this.localPath}` : "";
    }
    localSwitchAllowed() {
      try { return this.canSwitchLocal?.() !== false; }
      catch (_) { return false; }
    }
    async tryInitialLoopbackHandoff() {
      if (!this.localSwitchAllowed()) return false;
      const loopback = (this.descriptor.localCandidates || []).find(base => this.isLoopbackBase(base));
      if (!loopback || this.currentLocalBase()) return false;
      const target = await this.probeCandidate(loopback, 750);
      if (!target || this.userClosed) return false;
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
      const localBase = this.currentLocalBase();
      if (localBase) {
        try { await this.openLink("local", this.localWsUrl(localBase)); return; }
        catch (error) { this.onError?.(error); }
      }
      await this.tryInitialLoopbackHandoff();
      if (this.userClosed) return;
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

    async probeCandidate(candidate, timeoutMs = 2400) {
      const base = String(candidate).replace(/\/$/, "");
      const endpoint = `${base}/api/realtime/bootstrap?sid=${encodeURIComponent(this.descriptor.sessionId)}&t=${Date.now()}`;
      const addressSpace = this.isLoopbackBase(base) ? "loopback" : "local";
      // Kiwi/Chromium-Versionen unterscheiden sich bei Local Network Access.
      // Zuerst wird die aktuelle API verwendet, danach ein kompatibler Abruf ohne
      // die experimentelle Option. Private IP-Literale können dabei selbst den
      // Browser-Berechtigungsdialog auslösen.
      for (const includeAddressSpace of [true, false]) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const options = { cache: "no-store", mode: "cors", credentials: "omit", redirect: "error", signal: controller.signal };
          if (includeAddressSpace) options.targetAddressSpace = addressSpace;
          const response = await fetch(endpoint, options);
          if (!response.ok) continue;
          const data = await response.json();
          const target = this.role === "tv" ? data.tvUrl : data.clientUrl;
          if (target) return String(target);
        } catch (_) {
          // Der zweite Durchlauf deckt Browser ohne targetAddressSpace ab.
        } finally { clearTimeout(timer); }
      }
      return null;
    }

    async retryLocal() {
      if (this.userClosed || this.active === "local") return true;
      if (!this.localSwitchAllowed()) throw new Error("Diese Funktion benötigt derzeit die sichere Cloud-Verbindung.");
      const candidates = this.orderedCandidates();
      if (!candidates.length) throw new Error("Das Haupthandy hat keine lokale Adresse gemeldet.");
      this.onTransport?.("local", "probing");
      for (const candidate of candidates) {
        const target = await this.probeCandidate(candidate, 4200);
        if (!target) continue;
        this.onTransport?.("local", "switching");
        this.navigateToLocalTarget(target, true);
        return true;
      }
      this.onLocalUnavailable?.({ candidates, manual: true });
      // Ein aktiver Nutzerklick darf als letzter Versuch direkt zur privaten
      // Adresse navigieren. Manche Chromium-/TV-Browser blockieren den
      // vorgelagerten HTTPS→HTTP-fetch, erlauben aber die eigentliche
      // Top-Level-Navigation ins lokale Netz.
      const direct = this.directTarget(candidates[0]);
      if (direct) {
        this.onTransport?.("local", "switching");
        this.navigateToLocalTarget(direct, true);
        return true;
      }
      throw new Error("Der lokale Server ist aus diesem Browser nicht erreichbar. Prüfe die Berechtigung für den Zugriff auf das lokale Netzwerk oder verwende weiter die Cloud-Verbindung.");
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
      location.replace(url.toString());
    }

    async probeLocal(initial = false) {
      if (this.userClosed || this.active === "local") return true;
      if (!this.localSwitchAllowed()) {
        this.onTransport?.("cloud", "secure-audio");
        if (initial) await this.selectCloud();
        return false;
      }
      if (typeof global.HitsterRealtimeCanSwitchLocal === "function" && global.HitsterRealtimeCanSwitchLocal() === false) {
        this.onTransport?.("cloud", "secure-audio");
        if (initial) await this.selectCloud();
        else this.scheduleLocalProbe(30000);
        return false;
      }
      const candidates = this.orderedCandidates();
      if (!candidates.length) {
        this.onLocalUnavailable?.({ candidates: [], manual: false });
        if (initial) await this.selectCloud();
        return false;
      }
      this.onTransport?.("local", "probing");
      let target = null;
      for (const candidate of candidates) {
        target = await this.probeCandidate(candidate);
        if (target) break;
      }
      if (!target) {
        this.onTransport?.("cloud", "local-unavailable");
        this.onLocalUnavailable?.({ candidates, manual: false });
        if (initial) await this.selectCloud();
        else this.scheduleLocalProbe(30000);
        return false;
      }
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

      // Fällt ein lokaler Direktweg weg (WLAN verlassen, Netzwechsel oder
      // Android-Server kurz nicht erreichbar), bleibt derselbe Browser-Client
      // erhalten und verbindet sich sofort über die Cloud neu. Der äußere
      // Reconnect-Mechanismus wird erst bemüht, wenn auch dieser Fallback
      // scheitert; dadurch entstehen weder doppelte Transportinstanzen noch
      // verlorene Teilnehmerzustände.
      if (name === "local") {
        this.onTransport?.("cloud", "fallback");
        try {
          await this.openLink("cloud", this.cloudWsUrl());
          return;
        } catch (error) {
          this.onError?.(error);
        }
      }
      this.onClose?.({ ...info, transport: name, user: false, fallbackFailed: name === "local" });
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
