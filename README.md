# Hitster Cloudflare 1.4.18-diagnose3 – paralleler Hybridtransport

Dieser Stand enthält Worker, Durable Objects, Browser-Spieler und TV-Web-App für einen dauerhaft geöffneten Cloud-Kontrollkanal plus optionalen lokalen WLAN-Datenkanal.

## Verbindungsablauf

1. Spieler oder TV verbindet sich über die Cloudflare-HTTPS-Seite und authentifiziert sich.
2. Cloud-WebSocket bleibt geöffnet.
3. `WELCOME` liefert gegebenenfalls private LAN-Kandidaten des Haupthandys.
4. Der Browser prüft diese Kandidaten direkt und öffnet bei Erfolg einen zweiten lokalen WebSocket.
5. Die Seite bleibt auf Cloudflare; es gibt keinen Redirect auf eine lokale HTTP-Seite.
6. Fällt lokal aus, bleiben Cloudverbindung und Seite bestehen.
7. Später kann der lokale Kanal im Hintergrund erneut aufgebaut werden.

## Ressourcenregeln

- kein Viersekunden-`TV_READY`-Heartbeat,
- keine Cloudmeldung für jeden lokalen Probe oder Kanalverlust,
- unveränderte LAN-Kandidaten werden nicht erneut verteilt,
- ein Hostereignis wird für alle nicht lokal versorgten Empfänger in einer `DELIVERY_BATCH` gebündelt,
- lokal bereits versorgte Empfänger werden ausgeschlossen,
- hibernierbare WebSockets statt Polling,
- keine dauerhafte Speicherung laufender Spielsnapshots,
- 15-Minuten-Inaktivitätsbereinigung bleibt aktiv.

## Spotify-TV-Audio

Der vorhandene unsichtbare Spotify-TV-Webplayer bleibt erhalten. Der Audiostream läuft direkt zwischen Spotify und Fernseher; Cloudflare überträgt nur notwendige Steuer- und Tokennachrichten.

## Kompatibilität

`UsageGuard`, die Bindung `GUARD` und Migration `v2` dürfen nicht entfernt werden.

Siehe `docs/API.md`, `docs/DEPLOYMENT.md` und `docs/SPOTIFY_GERAET_ZIELBILD.md`.
