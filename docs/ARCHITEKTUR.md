# Architektur 1.4.8

## Cloud zuerst, aber ohne Spieldaten

Der öffentliche Join-Link löst den Raum über Cloudflare auf. Die Web-App verbindet zuerst den Cloud-WebSocket und authentifiziert sich. Das erste `WELCOME` ist nur ein Bootstrap: Es enthält Teilnehmer-/Raumdaten und lokale Kandidaten, aber keinen Spielsnapshot.

Der Bootstrap-Socket ist noch nicht als aktiver Empfänger ausgewählt. Deshalb wird er nicht in der Präsenz gezählt und erhält keine Zustände vom Haupthandy.

## Lokale Auswahl

Nach dem Bootstrap prüft die Web-App alle lokalen Kandidaten parallel. Ein erfolgreicher lokaler Bootstrap liefert die lokale Spieler- oder TV-Adresse. Vor dem Seitenwechsel meldet der Client `TRANSPORT_SELECTED { transport: "local" }`.

Die lokale Seite übernimmt Teilnehmerkennung, Resume-Token und letzte Sequenz. Der lokale Server liefert den aktuellen Snapshot direkt in seinem `WELCOME`.

## Cloud-Rückfall

Ist kein lokaler Kandidat erreichbar, meldet der Client `TRANSPORT_SELECTED { transport: "cloud" }`. Erst jetzt persistiert Cloudflare den Cloud-Teilnehmer und bestätigt den Transport. Das Haupthandy erhält `CLIENT_READY` beziehungsweise `TV_READY` mit `needsSnapshot: true` und sendet einen gezielten frischen Snapshot.

Während einer Cloud-Verbindung wird das WLAN weiter in großen Abständen geprüft. Bei späterem Erfolg meldet der Client die lokale Auswahl und wechselt auf die lokale Seite.

## Durable Objects

- `SessionRoom` koordiniert Raum, ausgewählte Cloud-WebSockets und Resume-Datensätze.
- `RoomAlias` löst einen kurzen Raumcode auf die Session auf.
- `PairRoom` verwaltet einen sechsstelligen TV-Code.

Spielzustände und Spotify-Tokens werden nicht gespeichert. Session und Alias besitzen Ablaufalarme mit `deleteAll()`-Bereinigung. Unveränderte Kandidaten und Aliasse werden nicht erneut geschrieben.
