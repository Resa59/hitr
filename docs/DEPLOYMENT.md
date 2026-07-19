# Veröffentlichung auf Cloudflare – Stand 1.4.18-diagnose3

## Termux

```bash
hitster-cloudflare-push "/storage/emulated/0/Download/Hitster-1.4.18-diagnose3-Cloudflare-Paket.zip"
```

## Manuell

1. bisherigen Workerstand sichern.
2. vollständigen Paketinhalt in das Repository `Resa59/hitr` übernehmen.
3. `npm install`.
4. `npm run check`.
5. `npm run deploy`.
6. `/api/health` muss `1.4.18-diagnose3` melden.
7. `/play/`, `/tv/`, `/tv/sw.js` und App Links prüfen.
8. TV-Seite vollständig neu laden; Cachekennung: `hitster-tv-v1.4.18-diagnose3`.

## Wesentlicher Abnahmetest

1. Haupthandy und Spieler in getrennten Netzen: Cloud-only muss funktionieren.
2. beide in Heim-WLAN/Hotspot: Browser erhält private IP, niemals Loopback.
3. Cloud-WebSocket bleibt verbunden; lokaler WebSocket kommt zusätzlich hinzu.
4. während des Spiels WLAN am Spieler trennen: Browser bleibt auf Cloudflare und kommuniziert weiter.
5. WLAN wieder aktivieren: lokaler Kanal darf später zurückkehren.
6. ein logisches Hostereignis darf nur eine Cloud-Batchnachricht für alle Cloudempfänger erzeugen.
7. nach 15 Minuten echter Inaktivität müssen Session und Alias verschwinden.

## Cloudflare-Kompatibilität

Nicht entfernen:

- `SessionRoom`
- `RoomAlias`
- `PairRoom`
- `UsageGuard`
- Bindung `GUARD`
- Migration `v2`
