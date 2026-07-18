(function (global) {
  "use strict";

  const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
  const PLAYER_NAME = "Hitster TV";

  class SpotifyTvAudioController {
    constructor(options = {}) {
      this.P = options.protocol || global.HitsterRealtimeProtocol;
      this.getDescriptor = options.getDescriptor || (() => null);
      this.getTransport = options.getTransport || (() => null);
      this.getParticipantId = options.getParticipantId || (() => "");
      this.button = options.button || document.getElementById("tvAudioButton");
      this.player = null;
      this.deviceId = "";
      this.sdkPromise = null;
      this.sdkReady = false;
      this.connectedToSpotify = false;
      this.audioRequested = this.readAudioFlag();
      this.token = "";
      this.tokenExpiresAt = 0;
      this.tokenRequestId = "";
      this.tokenCallbacks = [];
      this.tokenTimer = null;
      this.lastTransport = "";
      this.lastError = "";
      this.button?.addEventListener("click", () => this.handleButtonClick());
      this.updateButton(this.audioRequested ? "loading" : "idle", this.audioRequested ? "TV-Ton wird vorbereitet" : "TV-Ton");
    }

    readAudioFlag() {
      try { return new URLSearchParams(location.hash.replace(/^#/, "")).get("audio") === "1"; }
      catch (_) { return false; }
    }

    markAudioFlag() {
      try {
        const url = new URL(location.href);
        const params = new URLSearchParams(url.hash.replace(/^#/, ""));
        params.set("audio", "1");
        url.hash = params.toString();
        history.replaceState(null, "", url.toString());
      } catch (_) { }
    }

    canSwitchLocal() {
      // Web Playback benötigt einen sicheren HTTPS-Kontext. Sobald der Nutzer
      // TV-Audio angefordert hat, bleibt die TV-Seite deshalb auf Cloudflare.
      return !this.audioRequested && !this.connectedToSpotify;
    }

    secureContextAvailable() {
      return location.protocol === "https:" && (global.isSecureContext !== false);
    }

    onWelcome(transport) {
      this.lastTransport = transport || "";
      this.button?.classList.remove("hidden");
      // Das vergleichsweise große Spotify-SDK wird erst nach ausdrücklicher
      // Auswahl geladen. Dadurch bleiben normale TV-Partien datensparsam und
      // die Web-App kann weiterhin bevorzugt ins lokale WLAN wechseln.
      if (this.audioRequested && this.secureContextAvailable()) this.prepareSdk();
      else this.updateButton("available", this.secureContextAvailable() ? "TV-Ton" : "TV-Ton über Cloud");
      if (this.deviceId) this.sendCapability("ready", { ready: true, deviceId: this.deviceId, deviceName: PLAYER_NAME, activated: true });
    }

    handleMessage(message) {
      if (!message || message.type !== this.P?.TYPES?.TV_AUDIO_TOKEN) return false;
      const payload = message.payload || {};
      if (!payload.requestId || payload.requestId !== this.tokenRequestId) return true;
      clearTimeout(this.tokenTimer);
      this.tokenTimer = null;
      this.tokenRequestId = "";
      if (!payload.ok || !payload.accessToken) {
        const error = String(payload.error || "Spotify-Token konnte nicht bereitgestellt werden.");
        this.fail(error, "authentication");
        this.flushTokenCallbacks("");
        return true;
      }
      this.token = String(payload.accessToken);
      this.tokenExpiresAt = Number(payload.expiresAt || (Date.now() + 45 * 60 * 1000));
      this.flushTokenCallbacks(this.token);
      return true;
    }

    async handleButtonClick() {
      if (!this.secureContextAvailable()) {
        this.redirectToCloudAudio();
        return;
      }
      this.audioRequested = true;
      this.markAudioFlag();
      try {
        if (!this.player) {
          await this.prepareSdk(true);
          this.updateButton("available", "TV-Ton jetzt aktivieren");
          return;
        }
        // Der Aufruf selbst erfolgt vor dem ersten await direkt im Klickpfad.
        // Falls das SDK erst geladen werden musste, fordert die Oberfläche deshalb
        // bewusst einen zweiten kurzen Tastendruck an.
        const activation = this.player.activateElement();
        try { await activation; } catch (_) { }
        this.updateButton("connecting", "Spotify verbindet …");
        this.sendCapability("activating", { supported: true, activated: true });
        if (!this.connectedToSpotify) {
          const success = await this.player.connect();
          if (!success) throw new Error("Spotify Web Playback konnte nicht verbunden werden.");
          this.connectedToSpotify = true;
        } else if (this.deviceId) {
          this.updateButton("ready", "TV-Ton bereit");
          this.sendCapability("ready", { ready: true, deviceId: this.deviceId, deviceName: PLAYER_NAME, activated: true });
        }
      } catch (error) {
        this.fail(error?.message || String(error), "initialization");
      }
    }

    redirectToCloudAudio() {
      const descriptor = this.getDescriptor();
      const cloudBase = String(descriptor?.cloudBaseUrl || "").replace(/\/$/, "");
      if (!cloudBase || !descriptor) {
        this.fail("Für TV-Ton wird die sichere Cloud-Verbindung benötigt.", "secure-context");
        return;
      }
      try {
        const url = new URL("/tv/", cloudBase);
        const current = new URLSearchParams(location.hash.replace(/^#/, ""));
        const handoff = global.HitsterRealtimeHandoff?.() || {};
        if (handoff.participantId) current.set("pid", handoff.participantId);
        if (handoff.resumeToken) current.set("resume", handoff.resumeToken);
        if (handoff.lastSequence) current.set("seq", String(handoff.lastSequence));
        current.set("audio", "1");
        url.hash = current.toString();
        this.updateButton("loading", "Wechsel zur sicheren TV-Seite …");
        location.replace(url.toString());
      } catch (error) {
        this.fail(error?.message || String(error), "secure-context");
      }
    }

    prepareSdk(showLoading = true) {
      if (this.sdkPromise) return this.sdkPromise;
      if (showLoading) this.updateButton("loading", "Spotify wird geladen …");
      this.sdkPromise = new Promise((resolve, reject) => {
        const finish = () => {
          if (!global.Spotify?.Player) return reject(new Error("Spotify Web Playback wird von diesem Browser nicht unterstützt."));
          try {
            this.createPlayer();
            this.sdkReady = true;
            this.updateButton("available", "TV-Ton aktivieren");
            this.sendCapability("available", { supported: true, ready: false, secureContext: true });
            resolve(this.player);
          } catch (error) { reject(error); }
        };
        if (global.Spotify?.Player) return finish();
        const previous = global.onSpotifyWebPlaybackSDKReady;
        global.onSpotifyWebPlaybackSDKReady = () => {
          try { if (typeof previous === "function") previous(); } catch (_) { }
          finish();
        };
        let script = document.querySelector(`script[src="${SDK_URL}"]`);
        if (!script) {
          script = document.createElement("script");
          script.src = SDK_URL;
          script.async = true;
          script.onerror = () => reject(new Error("Spotify Web Playback SDK konnte nicht geladen werden."));
          document.head.appendChild(script);
        }
        setTimeout(() => { if (!global.Spotify?.Player) reject(new Error("Spotify Web Playback SDK antwortet nicht.")); }, 20000);
      }).catch(error => {
        this.sdkPromise = null;
        this.fail(error?.message || String(error), "initialization");
        throw error;
      });
      return this.sdkPromise;
    }

    createPlayer() {
      if (this.player) return;
      this.player = new global.Spotify.Player({
        name: PLAYER_NAME,
        volume: 0.8,
        enableMediaSession: false,
        getOAuthToken: callback => this.provideToken(callback)
      });
      this.player.addListener("ready", ({ device_id }) => {
        this.deviceId = String(device_id || "");
        this.connectedToSpotify = true;
        this.updateButton("ready", "TV-Ton bereit");
        this.sendCapability("ready", { supported: true, ready: true, deviceId: this.deviceId, deviceName: PLAYER_NAME, activated: true });
      });
      this.player.addListener("not_ready", ({ device_id }) => {
        if (!device_id || String(device_id) === this.deviceId) this.deviceId = "";
        this.updateButton("error", "TV-Ton getrennt");
        this.sendCapability("not-ready", { supported: true, ready: false, deviceId: String(device_id || "") });
      });
      this.player.addListener("player_state_changed", state => {
        if (!state) return;
        this.updateButton(state.paused ? "ready" : "playing", state.paused ? "TV-Ton bereit" : "TV-Ton läuft");
        this.sendCapability("playback", { ready: !!this.deviceId, deviceId: this.deviceId, paused: !!state.paused });
      });
      this.player.addListener("autoplay_failed", () => {
        this.updateButton("available", "TV-Ton erneut aktivieren");
        this.sendCapability("autoplay-failed", { supported: true, ready: !!this.deviceId, deviceId: this.deviceId });
      });
      for (const eventName of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
        this.player.addListener(eventName, ({ message }) => this.fail(message || eventName, eventName));
      }
    }

    provideToken(callback) {
      if (this.token && this.tokenExpiresAt > Date.now() + 45000) {
        callback(this.token);
        return;
      }
      this.tokenCallbacks.push(callback);
      if (this.tokenRequestId) return;
      const descriptor = this.getDescriptor();
      const transport = this.getTransport();
      if (!descriptor?.sessionId || !transport) {
        this.flushTokenCallbacks("");
        this.fail("Die Hitster-Verbindung ist noch nicht bereit.", "connection");
        return;
      }
      this.tokenRequestId = this.P.randomId(12);
      this.sendCapability("token-request", { requestId: this.tokenRequestId, reason: "web-playback", secureContext: true });
      clearTimeout(this.tokenTimer);
      this.tokenTimer = setTimeout(() => {
        this.tokenRequestId = "";
        this.flushTokenCallbacks("");
        this.fail("Spotify-Autorisierung vom Haupthandy hat zu lange gedauert.", "timeout");
      }, 15000);
    }

    flushTokenCallbacks(token) {
      const callbacks = this.tokenCallbacks.splice(0);
      for (const callback of callbacks) {
        try { callback(String(token || "")); } catch (_) { }
      }
      if (!token) { this.token = ""; this.tokenExpiresAt = 0; }
    }

    sendCapability(event, extra = {}) {
      try {
        const descriptor = this.getDescriptor();
        const transport = this.getTransport();
        if (!descriptor?.sessionId || !transport) return false;
        const message = this.P.envelope(this.P.TYPES.TV_AUDIO_CAPABILITY, descriptor.sessionId, {
          event,
          sdk: "spotify-web-playback",
          sdkProtocolVersion: 1,
          ...extra
        });
        transport.send(JSON.stringify(message));
        return true;
      } catch (_) { return false; }
    }

    fail(message, code) {
      this.lastError = String(message || "TV-Ton ist nicht verfügbar.").slice(0, 240);
      this.updateButton("error", this.lastError);
      this.sendCapability("error", { supported: false, ready: false, code: String(code || "error"), message: this.lastError });
    }

    updateButton(state, label) {
      if (!this.button) return;
      this.button.dataset.state = state;
      this.button.textContent = label;
      this.button.title = label;
    }
  }

  global.HitsterTvSpotifyAudioController = SpotifyTvAudioController;
})(window);
