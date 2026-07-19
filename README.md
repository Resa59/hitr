# Hitster Cloudflare 1.4.17 – lokale Transportauswahl vor Spieldaten

Dieser Stand enthält Worker, Durable Objects, Browser-Spieler und TV-Web-App für dauerhafte Räume, bevorzugte WLAN-Direktverbindungen und optionalen Spotify-TV-Ton.

## Verbindungsablauf

1. Der Browser stellt zunächst nur die Cloud-Verbindung her und authentifiziert sich.
2. `WELCOME` enthält ausschließlich Raum-/Teilnehmerdaten und lokale Kandidaten, aber keinen Spielsnapshot.
3. Alle lokalen Kandidaten werden parallel geprüft.
4. Der Browser meldet ausdrücklich `TRANSPORT_SELECTED: local|cloud`.
5. Nur bei Cloud-Auswahl wird der Teilnehmer im Durable Object gespeichert und beim Haupthandy ein frischer, gezielter Snapshot angefordert.
6. Laufende Spielzustände werden über Cloudflare nur transient weitergeleitet und nicht gespeichert.

## Cloudflare-Sparmaßnahmen

- kein Snapshot-Speicher im Durable Object,
- keine Teilnehmer-/Roster-Schreiboperation bei reinem Bootstrap und erfolgreichem WLAN-Wechsel,
- keine erneute Speicherung unveränderter lokaler Kandidaten oder Aliasdaten,
- keine Präsenzberechnung beim Schließen eines noch nicht ausgewählten Bootstrap-Sockets,
- 15-Minuten-Aktivitäts-Lease mit automatischer Session- und Raumcode-Alias-Bereinigung,
- Aktivitätsmeldung nur bei neuer Aktivität und höchstens alle fünf Minuten,
- hibernierbare WebSockets statt Polling.

Spotify-Tokens bleiben zielgerichtet, kurzlebig und vollständig transient. Bei aktivem Spotify-TV-Audio bleibt der Fernseher wegen des erforderlichen sicheren Browserkontexts auf HTTPS/Cloud.

Siehe `docs/DEPLOYMENT.md`, `docs/API.md` und `docs/SPOTIFY_GERAET_ZIELBILD.md`.

## Kompatibilität mit dem bestehenden Worker `hitr`

Der veröffentlichte Worker besitzt zusätzlich den Durable-Object-Namespace `UsageGuard` aus Migration `v2`. Der aktuelle Spielablauf verwendet ihn nicht aktiv, aber `src/worker.js` exportiert die Klasse weiterhin und `wrangler.jsonc` enthält die Bindung `GUARD`. Diese Einträge dürfen ohne ausdrückliche `delete_class`- oder `rename_class`-Migration nicht entfernt werden.
