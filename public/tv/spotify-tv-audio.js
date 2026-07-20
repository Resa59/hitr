(function (global) {
  "use strict";

  const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
  const PLAYER_NAME = "Hitster TV";
  const READY_TIMEOUT_MS = 20000;

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
      this.connectPromise = null;
      this.sdkReady = false;
      this.connectedToSpotify = false;
      this.audioRequested = this.readAudioFlag();
      this.token = "";
      this.tokenExpiresAt = 0;
      this.tokenRequestId = "";
      this.tokenCallbacks = [];
      this.tokenTimer = null;
      this.readyTimer = null;
      this.lastTransport = "";
      this.lastError = "";
      this.activationArmed = false;
      this.button?.addEventListener("click", () => this.startAutomatically(true));
      this.armActivationFromAnyInteraction();
      this.updateButton("loading", "Spotify wird automatisch vorbereitet …");
    }

    readAudioFlag() {
      try {
        // TV-Audio ist standardmäßig aktiv. audio=0 bleibt nur als technischer
        // Diagnose-/Kompatibilitätsausgang erhalten.
        return new URLSearchParams(location.hash.replace(/^#/, "")).get("audio") !== "0";
      } catch (_) { return true; }
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
      // Spotify Web Playback benötigt HTTPS. Der Cloud-Kontrollkanal bleibt
      // ohnehin bestehen; für TV-Audio darf die Seite deshalb nicht auf eine
      // unsichere lokale HTTP-Seite navigieren.
      return !this.audioRequested && !this.connectedToSpotify;
    }

    secureContextAvailable() {
      return location.protocol === "https:" && global.isSecureContext !== false;
    }

    armActivationFromAnyInteraction() {
      if (this.activationArmed) return;
      this.activationArmed = true;
      const activate = () => {
        this.activationArmed = false;
        document.removeEventListener("pointerdown", activate, true);
        document.removeEventListener("keydown", activate, true);
        try { this.player?.activateElement?.(); } catch (_) { }
      };
      document.addEventListener("pointerdown", activate, true);
      document.addEventListener("keydown", activate, true);
    }

    onWelcome(transport) {
      this.lastTransport = transport || "";
      this.button?.classList.remove("hidden");
      this.audioRequested = true;
      this.markAudioFlag();
      if (!this.secureContextAvailable()) {
        this.redirectToCloudAudio();
        return;
      }
      if (this.deviceId) {
        this.updateButton("ready", "Spotify bereit");
        this.sendCapability("ready", { ready: true, deviceId: this.deviceId, deviceName: PLAYER_NAME, activated: true });
        return;
      }
      void this.startAutomatically(false);
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

    async startAutomatically(userActivation = false) {
      if (!this.secureContextAvailable()) {
        this.redirectToCloudAudio();
        return "";
      }
      this.audioRequested = true;
      this.markAudioFlag();
      try {
        const player = await this.prepareSdk(true);
        if (userActivation) {
          try { await player.activateElement?.(); } catch (_) { }
        }
        if (this.deviceId && this.connectedToSpotify) return this.deviceId;
        if (this.connectPromise) return await this.connectPromise;
        this.updateButton("connecting", "Spotify verbindet …");
        this.sendCapability("activating", { supported: true, activated: true, automatic: true });
        this.connectPromise = (async () => {
          const accepted = await player.connect();
          if (!accepted) throw new Error("Spotify Web Playback konnte nicht verbunden werden.");
          await new Promise((resolve, reject) => {
            clearTimeout(this.readyTimer);
            this.readyTimer = setTimeout(() => {
              this.readyTimer = null;
              reject(new Error("Spotify hat diesen Fernseher nicht als Wiedergabegerät bestätigt."));
            }, READY_TIMEOUT_MS);
            const check = () => {
              if (this.deviceId && this.connectedToSpotify) resolve();
              else if (this.connectPromise) setTimeout(check, 100);
            };
            check();
          });
          return this.deviceId;
        })();
        return await this.connectPromise;
      } catch (error) {
        this.connectPromise = null;
        this.connectedToSpotify = false;
        this.fail(error?.message || String(error), "initialization");
        this.armActivationFromAnyInteraction();
        return "";
      }
    }

    async handleButtonClick() { return this.startAutomatically(true); }

    redirectToCloudAudio() {
      const descriptor = this.getDescriptor();
      const cloudBase = String(descriptor?.cloudBaseUrl || "").replace(/\/$/, "");
      if (!cloudBase || !descriptor) {
        this.fail("Für Spotify-Ton wird die sichere Cloud-Seite benötigt.", "secure-context");
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
            this.sendCapability("available", { supported: true, ready: false, secureContext: true, automatic: true });
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
        enableMediaSession: true,
        getOAuthToken: callback => this.provideToken(callback)
      });
      this.player.addListener("ready", ({ device_id }) => {
        clearTimeout(this.readyTimer);
        this.readyTimer = null;
        this.connectPromise = null;
        this.deviceId = String(device_id || "");
        this.connectedToSpotify = !!this.deviceId;
        this.updateButton("ready", "Spotify bereit");
        this.sendCapability("ready", { supported: true, ready: true, deviceId: this.deviceId, deviceName: PLAYER_NAME, activated: true, automatic: true });
      });
      this.player.addListener("not_ready", ({ device_id }) => {
        if (!device_id || String(device_id) === this.deviceId) this.deviceId = "";
        this.connectedToSpotify = false;
        this.connectPromise = null;
        this.updateButton("error", "Spotify nicht erreichbar · antippen zum Wiederholen");
        this.sendCapability("not-ready", { supported: true, ready: false, deviceId: String(device_id || "") });
      });
      this.player.addListener("player_state_changed", state => {
        if (!state) return;
        this.updateButton(state.paused ? "ready" : "playing", state.paused ? "Spotify bereit" : "Spotify läuft");
        this.sendCapability("playback", { ready: !!this.deviceId, deviceId: this.deviceId, paused: !!state.paused });
      });
      this.player.addListener("autoplay_failed", () => {
        this.updateButton("available", "Spotify wartet auf Bedienung");
        this.armActivationFromAnyInteraction();
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
      this.sendCapability("token-request", { requestId: this.tokenRequestId, reason: "web-playback", secureContext: true, automatic: true });
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
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
      this.lastError = String(message || "Spotify ist auf diesem Fernseher nicht verfügbar.").slice(0, 240);
      this.updateButton("error", `${this.lastError} · antippen zum Wiederholen`);
      this.sendCapability("error", { supported: false, ready: false, code: String(code || "error"), message: this.lastError });
    }

    updateButton(state, label) {
      if (!this.button) return;
      this.button.dataset.state = state;
      this.button.textContent = label;
      this.button.title = label;
      this.button.setAttribute("aria-label", label);
    }
  }

  global.HitsterTvSpotifyAudioController = SpotifyTvAudioController;
})(window);
