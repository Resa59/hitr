(function () {
  "use strict";
  const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
  const PLAYER_NAME = "Hitster Handy";
  const READY_TIMEOUT_MS = 20000;
  const state = {
    player: null,
    sdkPromise: null,
    connectPromise: null,
    deviceId: "",
    token: "",
    tokenExpiresAt: 0,
    tokenRequestId: "",
    tokenCallbacks: [],
    tokenTimer: null,
    readyTimer: null
  };
  const randomId = () => {
    try {
      const bytes = new Uint8Array(12); crypto.getRandomValues(bytes);
      return Array.from(bytes, v => v.toString(16).padStart(2, "0")).join("");
    } catch (_) { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  };
  const send = (type, extra = {}) => {
    try { parent.postMessage({ source: "hitster-phone-audio", type, ...extra }, "*"); } catch (_) { }
  };
  function flushToken(token) {
    const callbacks = state.tokenCallbacks.splice(0);
    for (const cb of callbacks) { try { cb(String(token || "")); } catch (_) { } }
    if (!token) { state.token = ""; state.tokenExpiresAt = 0; }
  }
  function provideToken(callback) {
    if (state.token && state.tokenExpiresAt > Date.now() + 45000) return callback(state.token);
    state.tokenCallbacks.push(callback);
    if (state.tokenRequestId) return;
    state.tokenRequestId = randomId();
    send("token-request", { requestId: state.tokenRequestId });
    clearTimeout(state.tokenTimer);
    state.tokenTimer = setTimeout(() => {
      state.tokenRequestId = "";
      flushToken("");
      send("error", { code: "token-timeout", message: "Spotify-Anmeldung hat zu lange gedauert." });
    }, 15000);
  }
  function createPlayer() {
    if (state.player) return state.player;
    state.player = new Spotify.Player({
      name: PLAYER_NAME,
      volume: 0.8,
      enableMediaSession: true,
      getOAuthToken: provideToken
    });
    state.player.addListener("ready", ({ device_id }) => {
      clearTimeout(state.readyTimer); state.readyTimer = null;
      state.connectPromise = null;
      state.deviceId = String(device_id || "");
      send("ready", { deviceId: state.deviceId, deviceName: PLAYER_NAME });
    });
    state.player.addListener("not_ready", ({ device_id }) => {
      if (!device_id || String(device_id) === state.deviceId) state.deviceId = "";
      state.connectPromise = null;
      send("not-ready", { deviceId: String(device_id || "") });
    });
    state.player.addListener("player_state_changed", playback => {
      if (playback) send("playback", { paused: !!playback.paused });
    });
    state.player.addListener("autoplay_failed", () => send("autoplay-failed"));
    for (const name of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
      state.player.addListener(name, ({ message }) => {
        state.connectPromise = null;
        send("error", { code: name, message: String(message || name) });
      });
    }
    return state.player;
  }
  function loadSdk() {
    if (state.sdkPromise) return state.sdkPromise;
    state.sdkPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (!window.Spotify?.Player) return reject(new Error("Spotify Web Playback wird nicht unterstützt."));
        resolve(createPlayer());
      };
      if (window.Spotify?.Player) return finish();
      const previous = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        try { if (typeof previous === "function") previous(); } catch (_) { }
        finish();
      };
      const script = document.createElement("script");
      script.src = SDK_URL; script.async = true;
      script.onerror = () => reject(new Error("Spotify Web Playback konnte nicht geladen werden."));
      document.head.appendChild(script);
      setTimeout(() => { if (!window.Spotify?.Player) reject(new Error("Spotify Web Playback antwortet nicht.")); }, 20000);
    }).catch(error => {
      state.sdkPromise = null;
      send("error", { code: "initialization_error", message: error?.message || String(error) });
      throw error;
    });
    return state.sdkPromise;
  }
  async function connect() {
    if (state.deviceId) return state.deviceId;
    if (state.connectPromise) return state.connectPromise;
    state.connectPromise = (async () => {
      const player = await loadSdk();
      const accepted = await player.connect();
      if (!accepted) throw new Error("Spotify Web Playback konnte nicht verbunden werden.");
      await new Promise((resolve, reject) => {
        clearTimeout(state.readyTimer);
        state.readyTimer = setTimeout(() => reject(new Error("Spotify hat den Handy-Player nicht bestätigt.")), READY_TIMEOUT_MS);
        const check = () => state.deviceId ? resolve() : state.connectPromise && setTimeout(check, 100);
        check();
      });
      return state.deviceId;
    })();
    try { return await state.connectPromise; }
    catch (error) {
      state.connectPromise = null;
      send("error", { code: "connect_error", message: error?.message || String(error) });
      return "";
    }
  }
  function disconnect() {
    clearTimeout(state.readyTimer); clearTimeout(state.tokenTimer);
    try { state.player?.disconnect?.(); } catch (_) { }
    state.player = null; state.sdkPromise = null; state.connectPromise = null;
    state.deviceId = ""; state.token = ""; state.tokenExpiresAt = 0;
    state.tokenRequestId = ""; flushToken("");
  }
  addEventListener("message", event => {
    if (event.source !== parent) return;
    const message = event.data || {};
    if (message.source !== "hitster-app") return;
    if (message.type === "connect") connect();
    else if (message.type === "activate") { try { state.player?.activateElement?.(); } catch (_) { } connect(); }
    else if (message.type === "disconnect") disconnect();
    else if (message.type === "token-response" && String(message.requestId || "") === state.tokenRequestId) {
      clearTimeout(state.tokenTimer); state.tokenTimer = null; state.tokenRequestId = "";
      if (!message.ok || !message.accessToken) {
        flushToken("");
        send("error", { code: "token-error", message: String(message.error || "Spotify-Zugriffstoken fehlt.") });
      } else {
        state.token = String(message.accessToken);
        state.tokenExpiresAt = Number(message.expiresAt || Date.now() + 45 * 60 * 1000);
        flushToken(state.token);
      }
    }
  });
  send("loaded");
})();
