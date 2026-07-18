# Deploymentkorrektur: Durable-Object-Migration `v2` und `UsageGuard`

## Anlass

Beim realen Deployment des bestehenden Workers `hitr` wurden nacheinander zwei historische Anforderungen sichtbar:

1. Cloudflare kennt bereits den Migrationstag `v2`.
2. Bereits vorhandene Durable Objects hängen von der veröffentlichten Klasse `UsageGuard` ab.

Ein leerer `v2`-Tag reicht deshalb nicht aus. Die tatsächliche veröffentlichte Historie muss vollständig abgebildet werden.

## Richtige Konfiguration

```json
"durable_objects": {
  "bindings": [
    { "name": "SESSIONS", "class_name": "SessionRoom" },
    { "name": "ALIASES", "class_name": "RoomAlias" },
    { "name": "PAIRS", "class_name": "PairRoom" },
    { "name": "GUARD", "class_name": "UsageGuard" }
  ]
},
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["SessionRoom", "RoomAlias", "PairRoom"] },
  { "tag": "v2", "new_sqlite_classes": ["UsageGuard"] }
]
```

Zusätzlich muss `src/worker.js` weiterhin `export class UsageGuard extends DurableObject` enthalten.

## Bedeutung

Der aktuelle Spielablauf verwendet `UsageGuard` nicht aktiv. Die Klasse bleibt ausschließlich aus Kompatibilitätsgründen erhalten. Sie darf nicht einfach aus Worker oder Wrangler-Konfiguration entfernt werden, solange keine ausdrücklich geplante `rename_class`- oder `delete_class`-Migration durchgeführt wird.

## Veröffentlichung

Die vollständigen aktuellen Dateien `src/worker.js` und `wrangler.jsonc` gemeinsam in das mit Cloudflare verbundene Repository übernehmen und in den veröffentlichten Branch committen. Durable Objects, Bindings oder bestehende Räume dürfen dafür nicht manuell gelöscht werden.
