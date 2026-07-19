# API-Vertrag 1.4.18-diagnose3

## Öffentliche Links

- `GET /j/<RAUMCODE>` – Spieler-Web-App
- `GET /p/<6STELLIG>/<PAIR_TOKEN>` – TV-App-Link beziehungsweise Browser-Fallback
- `GET /.well-known/assetlinks.json` – Android-Domainzuordnung

## Session

- `POST /api/realtime/session/open`
- `POST /api/realtime/session/update`
- `POST /api/realtime/session/activity`
- `POST /api/realtime/session/kick`
- `POST /api/realtime/session/end`
- `GET /api/realtime/resolve?code=<CODE>&role=player|tv`
- WebSocket `GET /api/realtime/ws?sid=<SESSION_ID>`

## Paralleler Cloud-/Lokalkanal

Nach `HELLO` bestätigt Cloudflare den Teilnehmer und liefert aktuelle LAN-Kandidaten. Die Cloudverbindung bleibt offen. Der Browser kann zusätzlich einen lokalen WebSocket öffnen.

Zustände:

- `cloudConnected`
- `localConnected`
- `preferredDataPath`

`127.0.0.1` wird normalen Spielern/TVs nicht angeboten. Lokale Verfügbarkeit und lokaler Verlust bleiben lokale Zustände und werden nicht als Cloudereignis übertragen.

## LAN-Kandidaten

Wenn sich die private Adresse des Haupthandys tatsächlich ändert, aktualisiert der Host die Session. Verbundene Teilnehmer erhalten `LOCAL_CANDIDATES`. Unveränderte Kandidaten erzeugen keine neue Aktualisierung.

## Gebündelte Zustellung

Der Host kann eine `DELIVERY_BATCH` senden:

```json
{
  "type": "DELIVERY_BATCH",
  "payload": {
    "deliveries": [
      { "recipients": ["player-b"], "message": { "type": "PLAYER_STATE", "payload": {} } },
      { "recipients": ["tv-1"], "message": { "type": "TV_STATE", "payload": {} } }
    ]
  }
}
```

Das Durable Object verteilt die enthaltenen Nachrichten an die jeweiligen Empfänger. Ausgehende Zustellungen werden nicht als eigene Hosteingänge erzeugt.

## Lokale kritische Spieleraktion

- Nachricht besitzt `messageId`.
- lokaler Server bestätigt mit `ACK` und `payload.replyTo`.
- fehlt ACK oder bricht der lokale Socket ab, sendet der Browser dieselbe Nutzmeldung einmal über Cloud.
- keine zusätzliche `LOCAL_FAILED`-Cloudnachricht.

## TV-Audio

- TV → Host: `TV_AUDIO_CAPABILITY`
- Host → konkretes TV: `TV_AUDIO_TOKEN`
- Token und laufende Zustände werden nicht dauerhaft gespeichert.
- kein regelmäßiger `TV_READY`-Heartbeat.

## Inaktivität

15 Minuten nach letzter echter Hostaktivität werden Session und Alias bereinigt. Technische ACK/PING/PONG verlängern die Sitzung nicht.
