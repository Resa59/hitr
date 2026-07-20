# Hitster Cloudflare 1.4.18-diagnose7 – Hybridtransport

Dieses Paket enthält Worker, Durable Objects, Browser-Spieler und TV-Web-App für einen dauerhaft verfügbaren Cloud-Kontrollkanal plus optionalen lokalen WLAN-/Hotspot-Datenkanal.

## Verbindungsablauf

1. Spieler oder TV verbindet sich über die Cloudflare-HTTPS-Seite.
2. Der Cloud-WebSocket bleibt als Kontroll- und Rückfallkanal geöffnet.
3. `WELCOME` liefert gegebenenfalls private LAN-Kandidaten des Haupthandys.
4. Der Browser prüft diese automatisch und öffnet bei Erfolg einen zweiten lokalen WebSocket.
5. Die Seite bleibt auf Cloudflare; es gibt keinen Redirect.
6. Fällt lokal aus oder blockiert das WLAN direkte Gerätekommunikation, läuft der Datenweg über Cloud.
7. Lokale Wiederholungsversuche werden mit zunehmenden Abständen ausgeführt.

## Ressourcenregeln

- keine Cloudmeldung für jeden lokalen Probeversuch oder Kanalverlust,
- Kandidaten nur bei echter Änderung aktualisieren,
- ein Hostereignis für nicht lokal versorgte Ziele in einer `DELIVERY_BATCH` bündeln,
- keine regelmäßigen App-Heartbeats,
- hibernierbare WebSockets,
- 15-Minuten-Inaktivitätsbereinigung,
- Diagnoseprotokolle lokal, begrenzt und nach Bestätigung zurückbauen.

## Spotify

TV-Spotify-Audio bleibt unverändert. Der experimentelle Spotify-Handyplayer befindet sich ausschließlich in der Android-App und verursacht keine zusätzliche Cloudflare-Kommunikation.

## Deployment

Nach einmaliger Einrichtung genügt in Termux:

```bash
hitster-deploy
```

Das Paket enthält `termux-deploy.sh`, führt alle paketinternen Tests aus, aktualisiert `Resa59/hitr` und prüft anschließend den Health-Build `1.4.18-diagnose7`.

## Kompatibilität

`UsageGuard`, die Bindung `GUARD` und Migration `v2` dürfen nicht entfernt werden.
