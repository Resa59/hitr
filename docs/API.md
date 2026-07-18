# API-Vertrag 1.4.9

## Öffentliche Links

- `GET /j/<RAUMCODE>` – Spieler-Web-App
- `GET /p/<6STELLIG>/<PAIR_TOKEN>` – TV-App-Link beziehungsweise Browser-Fallback
- `GET /.well-known/assetlinks.json` – Android-Domainzuordnung

## Session

- `POST /api/realtime/session/open`
- `POST /api/realtime/session/update`
- `POST /api/realtime/session/activity` – authentifiziertes, sparsames Host-Aktivitäts-Lease
- `POST /api/realtime/session/kick`
- `POST /api/realtime/session/end`
- `GET /api/realtime/resolve?code=<CODE>&role=player|tv`
- WebSocket `GET /api/realtime/ws?sid=<SESSION_ID>`

## Zweiphasige Transportauswahl

Nach `HELLO` sendet der Server ein Bootstrap-`WELCOME`:

```json
{
  "type": "WELCOME",
  "payload": {
    "transport": "cloud",
    "bootstrapOnly": true,
    "localCandidates": ["http://192.168.1.2:8765"],
    "snapshot": null
  }
}
```

Der Client prüft zuerst die lokalen Kandidaten und sendet danach:

```json
{
  "type": "TRANSPORT_SELECTED",
  "payload": { "transport": "local" }
}
```

oder

```json
{
  "type": "TRANSPORT_SELECTED",
  "payload": { "transport": "cloud" }
}
```

Bei Cloud-Auswahl folgt `TRANSPORT_CONFIRMED`. Gleichzeitig erhält der Host genau für diesen Teilnehmer `CLIENT_READY` beziehungsweise `TV_READY` mit `needsSnapshot: true`. Der Host antwortet mit einem gezielten `PLAYER_SNAPSHOT` oder `TV_SNAPSHOT`.

Vor der Auswahl werden Spieler und Fernseher weder als online gezählt noch mit Spielzuständen beliefert.

## TV-Audio

- TV sendet `TV_AUDIO_CAPABILITY`.
- Host sendet `TV_AUDIO_TOKEN` nur an die konkrete TV-`participantId`.
- `TV_AUDIO_TOKEN`, `PLAYER_STATE`, `PLAYER_SNAPSHOT`, `TV_STATE` und `TV_SNAPSHOT` werden nicht im Durable Object gespeichert.

## Ablauf und 15-Minuten-Lease

Der Host sendet bei neuer echter Aktivität höchstens alle fünf Minuten:

```json
{
  "sessionId": "...",
  "hostInviteToken": "...",
  "activityAt": 0
}
```

`SessionRoom` setzt den Alarm auf das früheste von 15 Minuten nach letzter Host-Aktivität, absolutem `expiresAt` oder dem Löschzeitpunkt nach ausdrücklichem Ende. Beim Ablauf werden Sockets geschlossen, der zugehörige Raumcode-Alias gelöscht und anschließend `deleteAll()` ausgeführt. Reine Keepalive-Nachrichten verlängern das Lease nicht.
