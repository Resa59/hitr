(function (global) {
  "use strict";

  const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
  const PLAYER_NAME = "Hitster Handy";
  const READY_TIMEOUT_MS = 20000;
  const state = {
    player: null,
    sdkPromise: null,
    connectPromise: null,
    deviceId: "",
    connected: false,
    tokenRequestId: "",
    tokenCallbacks: [],
    tokenTimer: null,
    readyTimer: null,
    activationArmed: false
  };

  function id() {
    try {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    } catch (_) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }

  function send(type, payload = {}) {
    try { global.parent.postMessage({ source: "hitster-phone-host", type, payload }, "*"); } catch (_) { }
  }

  function requestToken(callback) {
    state.tokenCallbacks.push(callback);
    if (state.tokenRequestId) return;
    state.tokenRequestId = `phone-${id()}`;
    send("PHONE_TOKEN_REQUEST", { requestId: state.tokenRequestId });
    clearTimeout(state.tokenTimer);
    state.tokenTimer = setTimeout(() => {
      state.tokenRequestId = "";
      flushTokens("");
      fail("Spotify-Anmeldung hat zu lange gedauert.", "token_timeout");
    }, 15000);
  }

  function flushTokens(token) {
    const callbacks = state.tokenCallbacks.splice(0);
    for (const callback of callbacks) {
      try { callback(String(token || "")); } catch (_) { }
    }
  }

  function receiveToken(payload) {
    if (!payload?.requestId || payload.requestId !== state.tokenRequestId) return;
    clearTimeout(state.tokenTimer);
    state.tokenTimer = null;
    state.tokenRequestId = "";
    if (!payload.ok || !payload.accessToken) {
      flushTokens("");
      fail(payload.error || "Spotify-Zugriffstoken fehlt.", "token_error");
      return;
    }
    flushTokens(String(payload.accessToken));
  }

  function loadSdk() {
    if (state.sdkPromise) return state.sdkPromise;
    send("PHONE_STATUS", { state: "loading", message: "Spotify wird im Hintergrund vorbereitet …" });
    state.sdkPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (!global.Spotify?.Player) return reject(new Error("Spotify Web Playback wird nicht unterstützt."));
        createPlayer();
        resolve(state.player);
      };
      if (global.Spotify?.Player) return finish();
      const previous = global.onSpotifyWebPlaybackSDKReady;
      global.onSpotifyWebPlaybackSDKReady = () => {
        try { if (typeof previous === "function") previous(); } catch (_) { }
        finish();
      };
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onerror = () => reject(new Error("Spotify Web Playback konnte nicht geladen werden."));
      document.head.appendChild(script);
      setTimeout(() => { if (!global.Spotify?.Player) reject(new Error("Spotify Web Playback antwortet nicht.")); }, 20000);
    }).catch(error => {
      state.sdkPromise = null;
      fail(error?.message || String(error), "sdk_error");
      throw error;
    });
    return state.sdkPromise;
  }

  function createPlayer() {
    if (state.player) return;
    state.player = new global.Spotify.Player({
      name: PLAYER_NAME,
      volume: 0.8,
      enableMediaSession: true,
      getOAuthToken: requestToken
    });
    state.player.addListener("ready", ({ device_id }) => {
      clearTimeout(state.readyTimer);
      state.readyTimer = null;
      state.connectPromise = null;
      state.deviceId = String(device_id || "");
      state.connected = !!state.deviceId;
      send("PHONE_PLAYER_READY", { deviceId: state.deviceId, deviceName: PLAYER_NAME });
    });
    state.player.addListener("not_ready", ({ device_id }) => {
      if (!device_id || String(device_id) === state.deviceId) state.deviceId = "";
      state.connected = false;
      state.connectPromise = null;
      send("PHONE_PLAYER_NOT_READY", { deviceId: String(device_id || "") });
    });
    state.player.addListener("player_state_changed", playback => {
      if (!playback) return;
      send("PHONE_PLAYER_STATE", { paused: !!playback.paused });
    });
    state.player.addListener("autoplay_failed", () => {
      armActivation();
      send("PHONE_STATUS", { state: "ready", message: "Hitster Handy ist als Spotify-Gerät bereit." });
    });
    for (const eventName of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
      state.player.addListener(eventName, ({ message }) => fail(message || eventName, eventName));
    }
  }

  async function connect() {
    if (state.deviceId && state.connected) return state.deviceId;
    if (state.connectPromise) return state.connectPromise;
    const player = await loadSdk();
    send("PHONE_STATUS", { state: "connecting", message: "Spotify verbindet …" });
    state.connectPromise = (async () => {
      const accepted = await player.connect();
      if (!accepted) throw new Error("Spotify Web Playback konnte nicht verbunden werden.");
      await new Promise((resolve, reject) => {
        clearTimeout(state.readyTimer);
        state.readyTimer = setTimeout(() => reject(new Error("Spotify hat Hitster Handy nicht als Gerät bestätigt.")), READY_TIMEOUT_MS);
        const check = () => {
          if (state.deviceId && state.connected) resolve();
          else if (state.connectPromise) setTimeout(check, 100);
        };
        check();
      });
      return state.deviceId;
    })();
    try { return await state.connectPromise; }
    catch (error) {
      state.connectPromise = null;
      state.connected = false;
      fail(error?.message || String(error), "connect_error");
      armActivation();
      return "";
    }
  }

  function activate() {
    try { state.player?.activateElement?.(); } catch (_) { }
    void connect();
  }

  function armActivation() {
    if (state.activationArmed) return;
    state.activationArmed = true;
    send("PHONE_ACTIVATION_NEEDED", {});
  }

  function fail(message, code) {
    clearTimeout(state.readyTimer);
    state.readyTimer = null;
    send("PHONE_PLAYER_ERROR", {
      code: String(code || "error"),
      message: String(message || "Spotify ist nicht verfügbar.").slice(0, 240)
    });
  }

  global.addEventListener("message", event => {
    if (event.source !== global.parent) return;
    const message = event.data || {};
    if (message.source !== "hitster-phone-app") return;
    if (message.type === "PHONE_CONNECT") void connect();
    else if (message.type === "PHONE_ACTIVATE") { state.activationArmed = false; activate(); }
    else if (message.type === "PHONE_TOKEN_RESPONSE") receiveToken(message.payload || {});
    else if (message.type === "PHONE_DISCONNECT") {
      try { state.player?.disconnect?.(); } catch (_) { }
      state.player = null; state.sdkPromise = null; state.connectPromise = null; state.deviceId = ""; state.connected = false;
    }
  });

  send("PHONE_HOST_READY", {
    secureContext: global.isSecureContext === true,
    encryptedMediaApi: typeof navigator.requestMediaKeySystemAccess === "function",
    userAgent: String(navigator.userAgent || "").slice(0, 180)
  });
})(window);
