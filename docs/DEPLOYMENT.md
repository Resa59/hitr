# Veröffentlichung auf Cloudflare – Stand 1.4.9

## Vollständiger Quellweg

1. Den bisherigen Worker-Stand sichern.
2. Den Inhalt dieses Verzeichnisses in das mit dem Worker `hitr` verbundene Repository übernehmen.
3. `npm install` ausführen.
4. `npm run check` ausführen. Dabei werden Syntax, statischer Vertrag und der Laufzeittest der Transportauswahl geprüft.
5. Mit dem richtigen Cloudflare-Konto `npm run deploy` ausführen.
6. Anschließend prüfen:
   - `/api/health`
   - `/api/realtime/health`
   - `/play/`
   - `/tv/`
   - `/tv/sw.js`
   - `/.well-known/assetlinks.json`
7. TV-Seite vollständig neu laden. Der Service-Worker-Cache trägt die Version `hitster-tv-v1.4.9`.

## Wesentlicher Abnahmetest

1. Raum auf dem Haupthandy öffnen.
2. Mit einem Gerät im selben WLAN beitreten.
3. Im Cloudflare-Log darf vor der Transportauswahl kein Spielsnapshot erscheinen.
4. Der Browser muss den lokalen Bootstrap parallel prüfen und anschließend auf die lokale URL wechseln.
5. Bei ausgeschaltetem WLAN muss stattdessen `TRANSPORT_SELECTED: cloud` folgen und ein frischer gezielter Snapshot eintreffen.
6. Bei später wieder verfügbarem WLAN muss der Client von Cloud auf lokal wechseln und in Cloud nicht mehr als aktiver Empfänger gezählt werden.
7. Nach 15 Minuten ohne echte Host-Aktivität muss Cloudflare `SESSION_ENDED` senden und Sitzung sowie Alias entfernen.

## Cloudflare-Ressourcen

- Die Cloud bleibt für Raumauflösung und Fallback notwendig.
- Reine WLAN-Teilnehmer erzeugen nach dem Bootstrap keine laufenden Spielzustandsnachrichten über Cloudflare.
- Spielsnapshots werden nicht dauerhaft gespeichert.
- Unveränderte lokale Kandidaten und Aliasse werden nicht erneut geschrieben.
- Ein Host-Aktivitäts-Lease wird nur bei neuer Aktivität und höchstens alle fünf Minuten erneuert.
- Nach 15 Minuten ohne Host-Aktivität werden Raum, Sockets und Alias per Alarm gelöscht.

## Spotify-TV-Audio

Spotify Web Playback benötigt HTTPS. Sobald TV-Audio angefordert oder verbunden ist, bleibt die TV-Seite bewusst auf dem sicheren Cloud-Weg. Der Audiostream läuft direkt zwischen Spotify und Fernseher; Cloudflare überträgt nur die Steuer-/Tokennachrichten.

## App-Link-Verifikation

Produktionspaket: `de.resa.hitstertrainer`

Produktionszertifikat SHA-256: `27:F6:22:E6:79:0D:91:66:5A:60:67:4B:8A:36:D1:72:2E:6C:77:7F:59:5A:ED:FF:1E:4A:35:92:23:83:A0:DC`

Für 1.4.9 ist keine neue Durable-Object-Migration erforderlich; die vorhandene Migration `v1` bleibt bestehen.
