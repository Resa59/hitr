# Hitster Cloudflare 1.4.18-diagnose10 – Hybridtransport und sichere Spotify-Webplayer

Dieses Paket enthält Worker, Durable Objects, Browser-Spieler, TV-Web-App und den sicheren HTTPS-Handyplayer unter `/phone/`.

## Verbindungsablauf

1. Spieler oder TV verbindet sich über die Cloudflare-HTTPS-Seite.
2. Der Cloud-WebSocket bleibt als Kontroll- und Rückfallkanal geöffnet.
3. `WELCOME` liefert gegebenenfalls private LAN-Kandidaten des Haupthandys.
4. Der Browser prüft diese automatisch und öffnet bei Erfolg einen zweiten lokalen WebSocket.
5. Die Seite bleibt auf Cloudflare; es gibt keinen Redirect.
6. Fällt lokal aus oder blockiert das WLAN direkte Gerätekommunikation, läuft der Datenweg über Cloud.

## Ressourcenregeln

- keine Cloudmeldung für jeden lokalen Probeversuch oder Kanalverlust,
- Kandidaten nur bei echter Änderung aktualisieren,
- nicht lokal versorgte Ziele eines Hostereignisses in einer `DELIVERY_BATCH` bündeln,
- keine regelmäßigen App-Heartbeats oder Spotify-Polling,
- hibernierbare WebSockets,
- 15-Minuten-Inaktivitätsbereinigung mit einmaliger 15-Sekunden-Hostrückfrage; die Rückfrage selbst ist kein Heartbeat.

## Spotify

- TV-Spotify startet nach Kopplung automatisch.
- `Hitster Handy` läuft in einem unsichtbaren HTTPS-Unterframe unter `/phone/`.
- Spotify-Tokens werden nicht im Durable Object oder Browser-Speicher gespeichert.
- Lautstärke- und Geräteänderungen erfolgen ereignisbasiert.

## Deployment

Nach einmaliger Einrichtung genügt in Termux:

```bash
hitster-deploy
```

Das Paket enthält `termux-deploy.sh`, führt alle paketinternen Tests aus, aktualisiert `Resa59/hitr` und prüft anschließend den Health-Build `1.4.18-diagnose10`.

## Kompatibilität

`UsageGuard`, die Bindung `GUARD` und Migration `v2` dürfen nicht entfernt werden.
