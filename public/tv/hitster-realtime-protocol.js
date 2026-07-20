(function (global) {
  "use strict";

  const VERSION = 1;
  const MAX_MESSAGE_BYTES = 32 * 1024;
  const ROLES = Object.freeze({ HOST: "host", PLAYER: "player", TV: "tv", SPECTATOR: "spectator" });
  const TYPES = Object.freeze({
    HELLO: "HELLO",
    WELCOME: "WELCOME",
    TRANSPORT_SELECTED: "TRANSPORT_SELECTED",
    TRANSPORT_CONFIRMED: "TRANSPORT_CONFIRMED",
    LOCAL_CANDIDATES: "LOCAL_CANDIDATES",
    DELIVERY_BATCH: "DELIVERY_BATCH",
    PLAYER_SNAPSHOT: "PLAYER_SNAPSHOT",
    PLAYER_STATE: "PLAYER_STATE",
    PLAYER_PRIVATE_STATE: "PLAYER_PRIVATE_STATE",
    TV_SNAPSHOT: "TV_SNAPSHOT",
    TV_STATE: "TV_STATE",
    PRESENCE: "PRESENCE",
    ANSWER_SUBMITTED: "ANSWER_SUBMITTED",
    SCORE_CONFIRMED: "SCORE_CONFIRMED",
    CLIENT_READY: "CLIENT_READY",
    TV_READY: "TV_READY",
    TV_AUDIO_CAPABILITY: "TV_AUDIO_CAPABILITY",
    TV_AUDIO_TOKEN: "TV_AUDIO_TOKEN",
    ACK: "ACK",
    LEAVE: "LEAVE",
    PING: "PING",
    PONG: "PONG",
    SESSION_ACTIVITY_CHECK: "SESSION_ACTIVITY_CHECK",
    SESSION_ENDED: "SESSION_ENDED",
    REMOVED: "REMOVED",
    ERROR: "ERROR"
  });

  const PRIVATE_KEYS = new Set([
    "answer", "answers", "answerText", "draft", "drafts", "input", "inputs",
    "typedText", "searchSuggestions", "validationError", "comparisonValue",
    "spotifyToken", "accessToken", "refreshToken", "authorizationCode",
    "clientSecret", "codeVerifier"
  ]);

  function randomId(bytes = 18) {
    const data = new Uint8Array(bytes);
    if (!global.crypto || typeof global.crypto.getRandomValues !== "function") {
      throw new Error("Sichere Zufallswerte sind nicht verfügbar.");
    }
    global.crypto.getRandomValues(data);
    let binary = "";
    for (const value of data) binary += String.fromCharCode(value);
    return global.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function now() { return Date.now(); }

  function utf8Length(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (global.TextEncoder) return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  function envelope(type, sessionId, payload, options = {}) {
    if (!type || !sessionId) throw new Error("type und sessionId sind erforderlich.");
    const out = {
      v: VERSION,
      type: String(type),
      sessionId: String(sessionId),
      messageId: options.messageId || randomId(12),
      sentAt: options.sentAt || now(),
      payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
    };
    if (Number.isInteger(options.sequence) && options.sequence >= 0) out.sequence = options.sequence;
    if (Number.isInteger(options.clientSequence) && options.clientSequence >= 0) out.clientSequence = options.clientSequence;
    if (options.sender) out.sender = options.sender;
    if (options.target) out.target = options.target;
    if (utf8Length(out) > MAX_MESSAGE_BYTES) throw new Error("Nachricht überschreitet 32 KiB.");
    return out;
  }

  function assertEnvelope(value, expectedSessionId) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Nachricht ist kein Objekt.");
    if (value.v !== VERSION) throw new Error("Nicht unterstützte Protokollversion.");
    if (!/^[A-Z0-9_]{1,64}$/.test(String(value.type || ""))) throw new Error("Ungültiger Nachrichtentyp.");
    if (!value.sessionId || String(value.sessionId).length < 16) throw new Error("Ungültige sessionId.");
    if (expectedSessionId && value.sessionId !== expectedSessionId) throw new Error("Nachricht gehört zu einer anderen Session.");
    if (!value.messageId || String(value.messageId).length < 8) throw new Error("Ungültige messageId.");
    if (!value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) throw new Error("Ungültige payload.");
    if (utf8Length(value) > MAX_MESSAGE_BYTES) throw new Error("Nachricht überschreitet 32 KiB.");
    return value;
  }

  function cloneAndRedact(value, extraPrivateKeys) {
    const denied = new Set(PRIVATE_KEYS);
    for (const key of extraPrivateKeys || []) denied.add(key);
    const seen = new WeakSet();
    function visit(node) {
      if (node == null || typeof node !== "object") return node;
      if (seen.has(node)) throw new Error("Zyklische Daten können nicht übertragen werden.");
      seen.add(node);
      if (Array.isArray(node)) return node.map(visit);
      const out = {};
      for (const [key, item] of Object.entries(node)) {
        if (denied.has(key)) continue;
        out[key] = visit(item);
      }
      return out;
    }
    return visit(value);
  }

  function sanitizeTvState(state) {
    const clean = cloneAndRedact(state, [
      "activeToken", "submittedTokens", "token", "resumeToken", "inviteToken",
      "playerInviteToken", "tvInviteToken", "roundKey", "automaticCorrect", "finalCorrect"
    ]);
    if (clean && Array.isArray(clean.participants)) {
      clean.participants = clean.participants.map(p => ({ participantId: p.participantId, name: p.name }));
    }
    return clean;
  }

  function sanitizePublicPlayerState(state) {
    return cloneAndRedact(state, ["resumeToken", "inviteToken", "playerInviteToken", "tvInviteToken"]);
  }

  function validateDescriptor(value) {
    if (!value || typeof value !== "object") throw new Error("SessionDescriptor fehlt.");
    if (Number(value.v || VERSION) !== VERSION) throw new Error("Unbekannte Descriptor-Version.");
    if (!value.sessionId || String(value.sessionId).length < 16) throw new Error("sessionId fehlt.");
    if (!Object.values(ROLES).includes(value.role)) throw new Error("Ungültige Rolle.");
    if (!value.inviteToken || String(value.inviteToken).length < 16) throw new Error("Einladungstoken fehlt.");
    return {
      v: VERSION,
      sessionId: String(value.sessionId),
      role: value.role,
      inviteToken: String(value.inviteToken),
      roomCode: String(value.roomCode || "").toUpperCase(),
      localCandidates: Array.isArray(value.localCandidates) ? value.localCandidates.map(String) : [],
      cloudBaseUrl: value.cloudBaseUrl ? String(value.cloudBaseUrl) : "",
      expiresAt: Number(value.expiresAt || 0)
    };
  }

  function parseJoinLink(input) {
    const url = new URL(String(input), global.location ? global.location.href : "https://invalid.local/");
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    const local = params.getAll("local").filter(Boolean);
    return validateDescriptor({
      v: Number(params.get("v") || url.searchParams.get("v") || VERSION),
      sessionId: params.get("sid") || url.searchParams.get("sid") || "",
      role: params.get("role") || url.searchParams.get("role") || ROLES.PLAYER,
      inviteToken: params.get("invite") || url.searchParams.get("invite") || "",
      roomCode: params.get("code") || url.searchParams.get("code") || "",
      localCandidates: local,
      cloudBaseUrl: params.get("cloud") || url.origin,
      expiresAt: Number(params.get("exp") || 0)
    });
  }

  function buildJoinLink(baseUrl, descriptor) {
    const d = validateDescriptor(descriptor);
    const url = new URL(baseUrl);
    const params = new URLSearchParams();
    params.set("v", String(VERSION));
    params.set("sid", d.sessionId);
    params.set("role", d.role);
    params.set("invite", d.inviteToken);
    if (d.roomCode) params.set("code", d.roomCode);
    for (const local of d.localCandidates) params.append("local", local);
    if (d.cloudBaseUrl && d.cloudBaseUrl !== url.origin) params.set("cloud", d.cloudBaseUrl);
    if (d.expiresAt) params.set("exp", String(d.expiresAt));
    url.hash = params.toString();
    return url.toString();
  }

  global.HitsterRealtimeProtocol = Object.freeze({
    VERSION, MAX_MESSAGE_BYTES, ROLES, TYPES, randomId, envelope, assertEnvelope,
    cloneAndRedact, sanitizeTvState, sanitizePublicPlayerState,
    validateDescriptor, parseJoinLink, buildJoinLink, utf8Length
  });
})(window);
