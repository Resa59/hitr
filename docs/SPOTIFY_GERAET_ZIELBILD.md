# Hitster TV als Spotify-Gerät – Cloudflare-Stand 1.4.8

Die Funktion ist implementiert.

## Nachrichten

- TV → Host: `TV_AUDIO_CAPABILITY`
- Host → genau ein TV: `TV_AUDIO_TOKEN`

## Sicherheitsregeln

- kein Token in QR-Code, URL oder SessionDescriptor,
- kein Token in `TV_STATE` oder `TV_SNAPSHOT`,
- keine Speicherung im Durable Object,
- keine Wiederholungsqueue bei unterbrochener Host-Verbindung,
- zielgerichtete Zustellung über `target.participantId`,
- TV-Token nur nach einer Anfrage der bereits authentifizierten TV-Rolle,
- tatsächlicher Audio-Stream läuft nicht über Cloudflare.

## Secure Context

Spotify Web Playback benötigt HTTPS. Wird der Audiomodus von einer lokalen HTTP-TV-Seite aus aktiviert, übergibt sie die bestehende Session an `/tv/` auf der Cloudflare-Domain. Während der Audiomodus aktiv ist, wird der automatische lokale Seitenwechsel gesperrt.
