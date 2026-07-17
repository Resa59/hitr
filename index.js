// Hitster TV – Cloudflare Worker mit automatisch bereitgestellter D1-Datenbank.
// Bereit für „Deploy to Cloudflare“ aus einem öffentlichen GitHub-Repository.

const ASSETS = {"/":["text/html; charset=utf-8","<!doctype html>\n<html lang=\"de\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\" />\n    <meta name=\"theme-color\" content=\"#101014\" />\n    <meta name=\"robots\" content=\"noindex,nofollow\" />\n    <title>Hitster TV</title>\n    <link rel=\"manifest\" href=\"/manifest.webmanifest\" />\n    <link rel=\"stylesheet\" href=\"/styles.css\" />\n  </head>\n  <body class=\"tv-body\">\n    <main class=\"tv-shell\">\n      <header class=\"topbar\">\n        <div class=\"brand\"><span class=\"brand-mark\">H</span><span>Hitster TV</span></div>\n        <div class=\"topbar-actions\">\n          <span id=\"connection-status\" class=\"status-pill\" data-state=\"idle\">Startet …</span>\n          <button id=\"fullscreen\" class=\"ghost-button\" type=\"button\">Vollbild</button>\n        </div>\n      </header>\n\n      <section id=\"pairing\" class=\"pairing-screen\">\n        <div class=\"pairing-copy\">\n          <p class=\"eyebrow\">Fernseher verbinden</p>\n          <h1>Mit Hitster verbinden</h1>\n          <p id=\"pairing-hint\" class=\"lead\">Sitzung wird vorbereitet …</p>\n          <div class=\"code-card\">\n            <span>Verbindungscode</span>\n            <strong id=\"room-code\">--- ---</strong>\n          </div>\n          <p class=\"bookmark-hint\">Diese Seite als Favorit speichern. Dann muss die Adresse nur einmal eingegeben werden.</p>\n        </div>\n        <div class=\"qr-card\">\n          <canvas id=\"qr-code\" width=\"360\" height=\"360\" aria-label=\"QR-Code zur Verbindung\"></canvas>\n          <span>QR-Code mit dem Haupthandy scannen</span>\n        </div>\n      </section>\n\n      <section id=\"game\" class=\"game-screen\" hidden>\n        <div class=\"game-card\">\n          <p id=\"eyebrow\" class=\"eyebrow\"></p>\n          <h1 id=\"headline\">Hitster</h1>\n          <p id=\"subline\" class=\"lead\"></p>\n\n          <div id=\"progress\" class=\"progress-track\" hidden><span id=\"progress-bar\"></span></div>\n\n          <div id=\"reveal\" class=\"reveal-card\" hidden>\n            <div>\n              <p id=\"song-title\" class=\"song-title\"></p>\n              <p id=\"artist\" class=\"artist\"></p>\n            </div>\n            <strong id=\"year\" class=\"year\" hidden></strong>\n          </div>\n\n          <div id=\"scoreboard\" class=\"scoreboard\" hidden></div>\n        </div>\n      </section>\n\n      <footer class=\"footerbar\">\n        <span id=\"game-title\">Hitster</span>\n        <span id=\"footer-status\">Warte auf das Haupthandy</span>\n      </footer>\n    </main>\n\n    <section id=\"claim-dialog\" class=\"dialog-backdrop\" hidden>\n      <div class=\"dialog-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"claim-text\">\n        <p class=\"eyebrow\">Verbindungsanfrage</p>\n        <h2 id=\"claim-text\">Mit dem Haupthandy verbinden?</h2>\n        <p>Mit OK oder Enter bestätigen.</p>\n        <div class=\"dialog-actions\">\n          <button id=\"deny-claim\" class=\"secondary-button\" type=\"button\">Ablehnen</button>\n          <button id=\"approve-claim\" class=\"primary-button\" type=\"button\">Verbinden</button>\n        </div>\n      </div>\n    </section>\n\n    <script type=\"module\" src=\"/tv.js\"></script>\n  </body>\n</html>\n"],"/index.html":["text/html; charset=utf-8","<!doctype html>\n<html lang=\"de\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\" />\n    <meta name=\"theme-color\" content=\"#101014\" />\n    <meta name=\"robots\" content=\"noindex,nofollow\" />\n    <title>Hitster TV</title>\n    <link rel=\"manifest\" href=\"/manifest.webmanifest\" />\n    <link rel=\"stylesheet\" href=\"/styles.css\" />\n  </head>\n  <body class=\"tv-body\">\n    <main class=\"tv-shell\">\n      <header class=\"topbar\">\n        <div class=\"brand\"><span class=\"brand-mark\">H</span><span>Hitster TV</span></div>\n        <div class=\"topbar-actions\">\n          <span id=\"connection-status\" class=\"status-pill\" data-state=\"idle\">Startet …</span>\n          <button id=\"fullscreen\" class=\"ghost-button\" type=\"button\">Vollbild</button>\n        </div>\n      </header>\n\n      <section id=\"pairing\" class=\"pairing-screen\">\n        <div class=\"pairing-copy\">\n          <p class=\"eyebrow\">Fernseher verbinden</p>\n          <h1>Mit Hitster verbinden</h1>\n          <p id=\"pairing-hint\" class=\"lead\">Sitzung wird vorbereitet …</p>\n          <div class=\"code-card\">\n            <span>Verbindungscode</span>\n            <strong id=\"room-code\">--- ---</strong>\n          </div>\n          <p class=\"bookmark-hint\">Diese Seite als Favorit speichern. Dann muss die Adresse nur einmal eingegeben werden.</p>\n        </div>\n        <div class=\"qr-card\">\n          <canvas id=\"qr-code\" width=\"360\" height=\"360\" aria-label=\"QR-Code zur Verbindung\"></canvas>\n          <span>QR-Code mit dem Haupthandy scannen</span>\n        </div>\n      </section>\n\n      <section id=\"game\" class=\"game-screen\" hidden>\n        <div class=\"game-card\">\n          <p id=\"eyebrow\" class=\"eyebrow\"></p>\n          <h1 id=\"headline\">Hitster</h1>\n          <p id=\"subline\" class=\"lead\"></p>\n\n          <div id=\"progress\" class=\"progress-track\" hidden><span id=\"progress-bar\"></span></div>\n\n          <div id=\"reveal\" class=\"reveal-card\" hidden>\n            <div>\n              <p id=\"song-title\" class=\"song-title\"></p>\n              <p id=\"artist\" class=\"artist\"></p>\n            </div>\n            <strong id=\"year\" class=\"year\" hidden></strong>\n          </div>\n\n          <div id=\"scoreboard\" class=\"scoreboard\" hidden></div>\n        </div>\n      </section>\n\n      <footer class=\"footerbar\">\n        <span id=\"game-title\">Hitster</span>\n        <span id=\"footer-status\">Warte auf das Haupthandy</span>\n      </footer>\n    </main>\n\n    <section id=\"claim-dialog\" class=\"dialog-backdrop\" hidden>\n      <div class=\"dialog-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"claim-text\">\n        <p class=\"eyebrow\">Verbindungsanfrage</p>\n        <h2 id=\"claim-text\">Mit dem Haupthandy verbinden?</h2>\n        <p>Mit OK oder Enter bestätigen.</p>\n        <div class=\"dialog-actions\">\n          <button id=\"deny-claim\" class=\"secondary-button\" type=\"button\">Ablehnen</button>\n          <button id=\"approve-claim\" class=\"primary-button\" type=\"button\">Verbinden</button>\n        </div>\n      </div>\n    </section>\n\n    <script type=\"module\" src=\"/tv.js\"></script>\n  </body>\n</html>\n"],"/controller":["text/html; charset=utf-8","<!doctype html>\n<html lang=\"de\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"theme-color\" content=\"#101014\" />\n    <meta name=\"robots\" content=\"noindex,nofollow\" />\n    <title>Hitster TV – Teststeuerung</title>\n    <link rel=\"stylesheet\" href=\"/styles.css\" />\n  </head>\n  <body class=\"controller-body\">\n    <main class=\"controller-shell\">\n      <header class=\"controller-header\">\n        <div class=\"brand\"><span class=\"brand-mark\">H</span><span>Hitster TV</span></div>\n        <span id=\"socket-status\" class=\"status-pill\" data-state=\"idle\">Nicht verbunden</span>\n      </header>\n\n      <section id=\"controller-pairing\" class=\"controller-card\">\n        <p class=\"eyebrow\">Teststeuerung</p>\n        <h1>Fernseher koppeln</h1>\n        <p>QR-Code scannen oder den sechsstelligen Code vom Fernseher eingeben.</p>\n        <label for=\"code-input\">Verbindungscode</label>\n        <input id=\"code-input\" class=\"code-input\" inputmode=\"numeric\" maxlength=\"6\" autocomplete=\"one-time-code\" placeholder=\"123456\" />\n        <button id=\"pair-button\" class=\"primary-button wide\" type=\"button\">Verbinden</button>\n        <p id=\"controller-status\" class=\"inline-status\" data-state=\"idle\">Noch nicht verbunden</p>\n      </section>\n\n      <section id=\"controller-controls\" class=\"controller-card\" hidden>\n        <p class=\"eyebrow\">Cloudflare-Test</p>\n        <h1>TV-Ansicht steuern</h1>\n        <p>Diese Seite simuliert später die App. Sie dient nur zum Testen des Cloudflare-Teils.</p>\n        <div class=\"button-grid\">\n          <button class=\"secondary-button\" data-demo=\"lobby\" type=\"button\">Lobby</button>\n          <button class=\"secondary-button\" data-demo=\"round\" type=\"button\">Rundenstart</button>\n          <button class=\"secondary-button\" data-demo=\"playing\" type=\"button\">Lied läuft</button>\n          <button class=\"secondary-button\" data-demo=\"input\" type=\"button\">Eingabe</button>\n          <button class=\"secondary-button\" data-demo=\"waiting\" type=\"button\">Warten</button>\n          <button class=\"secondary-button\" data-demo=\"scoreboard\" type=\"button\">Zwischenstand</button>\n          <button class=\"secondary-button\" data-demo=\"finished\" type=\"button\">Ende</button>\n        </div>\n\n        <div class=\"form-divider\"></div>\n        <h2>Eigene Auflösung senden</h2>\n        <label for=\"custom-title\">Titel</label>\n        <input id=\"custom-title\" value=\"Dancing Queen\" />\n        <label for=\"custom-artist\">Künstler</label>\n        <input id=\"custom-artist\" value=\"ABBA\" />\n        <label for=\"custom-year\">Jahr</label>\n        <input id=\"custom-year\" inputmode=\"numeric\" value=\"1976\" />\n        <button id=\"send-reveal\" class=\"primary-button wide\" type=\"button\">Auflösung anzeigen</button>\n      </section>\n    </main>\n    <script type=\"module\" src=\"/controller.js\"></script>\n  </body>\n</html>\n"],"/controller.html":["text/html; charset=utf-8","<!doctype html>\n<html lang=\"de\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"theme-color\" content=\"#101014\" />\n    <meta name=\"robots\" content=\"noindex,nofollow\" />\n    <title>Hitster TV – Teststeuerung</title>\n    <link rel=\"stylesheet\" href=\"/styles.css\" />\n  </head>\n  <body class=\"controller-body\">\n    <main class=\"controller-shell\">\n      <header class=\"controller-header\">\n        <div class=\"brand\"><span class=\"brand-mark\">H</span><span>Hitster TV</span></div>\n        <span id=\"socket-status\" class=\"status-pill\" data-state=\"idle\">Nicht verbunden</span>\n      </header>\n\n      <section id=\"controller-pairing\" class=\"controller-card\">\n        <p class=\"eyebrow\">Teststeuerung</p>\n        <h1>Fernseher koppeln</h1>\n        <p>QR-Code scannen oder den sechsstelligen Code vom Fernseher eingeben.</p>\n        <label for=\"code-input\">Verbindungscode</label>\n        <input id=\"code-input\" class=\"code-input\" inputmode=\"numeric\" maxlength=\"6\" autocomplete=\"one-time-code\" placeholder=\"123456\" />\n        <button id=\"pair-button\" class=\"primary-button wide\" type=\"button\">Verbinden</button>\n        <p id=\"controller-status\" class=\"inline-status\" data-state=\"idle\">Noch nicht verbunden</p>\n      </section>\n\n      <section id=\"controller-controls\" class=\"controller-card\" hidden>\n        <p class=\"eyebrow\">Cloudflare-Test</p>\n        <h1>TV-Ansicht steuern</h1>\n        <p>Diese Seite simuliert später die App. Sie dient nur zum Testen des Cloudflare-Teils.</p>\n        <div class=\"button-grid\">\n          <button class=\"secondary-button\" data-demo=\"lobby\" type=\"button\">Lobby</button>\n          <button class=\"secondary-button\" data-demo=\"round\" type=\"button\">Rundenstart</button>\n          <button class=\"secondary-button\" data-demo=\"playing\" type=\"button\">Lied läuft</button>\n          <button class=\"secondary-button\" data-demo=\"input\" type=\"button\">Eingabe</button>\n          <button class=\"secondary-button\" data-demo=\"waiting\" type=\"button\">Warten</button>\n          <button class=\"secondary-button\" data-demo=\"scoreboard\" type=\"button\">Zwischenstand</button>\n          <button class=\"secondary-button\" data-demo=\"finished\" type=\"button\">Ende</button>\n        </div>\n\n        <div class=\"form-divider\"></div>\n        <h2>Eigene Auflösung senden</h2>\n        <label for=\"custom-title\">Titel</label>\n        <input id=\"custom-title\" value=\"Dancing Queen\" />\n        <label for=\"custom-artist\">Künstler</label>\n        <input id=\"custom-artist\" value=\"ABBA\" />\n        <label for=\"custom-year\">Jahr</label>\n        <input id=\"custom-year\" inputmode=\"numeric\" value=\"1976\" />\n        <button id=\"send-reveal\" class=\"primary-button wide\" type=\"button\">Auflösung anzeigen</button>\n      </section>\n    </main>\n    <script type=\"module\" src=\"/controller.js\"></script>\n  </body>\n</html>\n"],"/styles.css":["text/css; charset=utf-8",":root {\n  color-scheme: dark;\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n  background: #101014;\n  color: #f7f7f8;\n  font-synthesis: none;\n}\n\n* { box-sizing: border-box; }\nhtml, body { margin: 0; min-height: 100%; }\nbody {\n  background:\n    radial-gradient(circle at 15% 20%, rgba(118, 76, 255, 0.24), transparent 34rem),\n    radial-gradient(circle at 85% 80%, rgba(255, 81, 142, 0.18), transparent 30rem),\n    #101014;\n}\nbutton, input { font: inherit; }\nbutton { cursor: pointer; }\n[hidden] { display: none !important; }\n\n.tv-body { min-height: 100vh; overflow: hidden; }\n.tv-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; padding: clamp(18px, 2vw, 34px); gap: 24px; }\n.topbar, .footerbar, .controller-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }\n.brand { display: flex; align-items: center; gap: 12px; font-size: clamp(20px, 2vw, 32px); font-weight: 800; letter-spacing: -0.03em; }\n.brand-mark { width: 1.65em; height: 1.65em; display: grid; place-items: center; border-radius: 0.45em; background: linear-gradient(135deg, #7a55ff, #ff4d91); box-shadow: 0 12px 35px rgba(112, 76, 255, 0.35); }\n.topbar-actions { display: flex; align-items: center; gap: 12px; }\n.status-pill { display: inline-flex; align-items: center; min-height: 42px; padding: 9px 16px; border-radius: 999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.11); font-weight: 700; }\n.status-pill[data-state=\"ok\"], .inline-status[data-state=\"ok\"] { color: #91f2b5; }\n.status-pill[data-state=\"warn\"], .inline-status[data-state=\"warn\"] { color: #ffd47a; }\n.status-pill[data-state=\"error\"], .inline-status[data-state=\"error\"] { color: #ff9ca9; }\n.ghost-button, .secondary-button, .primary-button { border: 0; border-radius: 16px; padding: 13px 20px; font-weight: 800; }\n.ghost-button, .secondary-button { color: #fff; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.12); }\n.primary-button { color: white; background: linear-gradient(135deg, #7351ff, #ef4f93); box-shadow: 0 12px 30px rgba(116, 80, 255, 0.3); }\n.primary-button:focus, .secondary-button:focus, .ghost-button:focus { outline: 4px solid rgba(255,255,255,0.75); outline-offset: 4px; }\n\n.pairing-screen { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr); align-items: center; gap: clamp(28px, 5vw, 80px); max-width: 1500px; width: 100%; margin: auto; }\n.pairing-copy h1, .game-card h1 { margin: 0; font-size: clamp(54px, 7vw, 118px); line-height: 0.96; letter-spacing: -0.06em; }\n.eyebrow { margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 900; color: #b8a7ff; font-size: clamp(15px, 1.4vw, 24px); }\n.lead { margin: 26px 0 0; color: #c9c9d2; font-size: clamp(23px, 2.4vw, 39px); line-height: 1.35; max-width: 32ch; }\n.code-card { margin-top: clamp(28px, 4vh, 55px); display: inline-flex; flex-direction: column; gap: 8px; padding: 22px 30px; border-radius: 24px; background: rgba(255,255,255,0.075); border: 1px solid rgba(255,255,255,0.12); }\n.code-card span { color: #b9b9c3; font-weight: 700; }\n.code-card strong { font-variant-numeric: tabular-nums; letter-spacing: 0.12em; font-size: clamp(40px, 5vw, 78px); }\n.bookmark-hint { color: #9696a2; font-size: clamp(15px, 1.3vw, 21px); max-width: 48ch; margin-top: 24px; }\n.qr-card { justify-self: center; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: clamp(22px, 2.5vw, 38px); border-radius: 34px; background: rgba(255,255,255,0.94); color: #111; box-shadow: 0 30px 80px rgba(0,0,0,0.35); font-weight: 800; text-align: center; }\n.qr-card canvas { width: min(27vw, 360px); height: min(27vw, 360px); background: #fff; }\n.footerbar { color: #8f8f9b; font-weight: 700; font-size: clamp(14px, 1.25vw, 20px); }\n\n.game-screen { min-height: 0; display: grid; place-items: center; }\n.game-card { width: min(1500px, 100%); text-align: center; padding: clamp(24px, 4vw, 70px); }\n.game-card .lead { margin-left: auto; margin-right: auto; }\n.progress-track { width: min(900px, 85%); height: 18px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; margin: 48px auto 0; }\n.progress-track span { display: block; height: 100%; width: 0; border-radius: inherit; background: linear-gradient(90deg, #7351ff, #ef4f93); transition: width 300ms ease; }\n.reveal-card { margin: 48px auto 0; max-width: 1150px; display: flex; align-items: center; justify-content: space-between; gap: 40px; text-align: left; padding: 34px 42px; border-radius: 30px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }\n.song-title { margin: 0; font-size: clamp(34px, 4.5vw, 74px); font-weight: 900; line-height: 1.05; letter-spacing: -0.04em; }\n.artist { margin: 12px 0 0; font-size: clamp(23px, 2.5vw, 42px); color: #c6c6d0; }\n.year { flex: 0 0 auto; font-size: clamp(54px, 7vw, 110px); line-height: 1; }\n.scoreboard { max-width: 1000px; margin: 44px auto 0; display: grid; gap: 12px; }\n.score-row { display: flex; justify-content: space-between; align-items: center; gap: 30px; padding: 18px 26px; border-radius: 18px; background: rgba(255,255,255,0.075); border: 1px solid rgba(255,255,255,0.09); font-size: clamp(24px, 2.5vw, 42px); }\n.score-row:first-child { background: linear-gradient(135deg, rgba(115,81,255,0.24), rgba(239,79,147,0.18)); }\n.score-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,0.78); backdrop-filter: blur(16px); }\n.dialog-card { width: min(720px, 100%); padding: 40px; border-radius: 30px; background: #202027; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 40px 100px rgba(0,0,0,0.5); }\n.dialog-card h2 { margin: 0; font-size: clamp(32px, 4vw, 58px); line-height: 1.08; }\n.dialog-card p:not(.eyebrow) { color: #bdbdc7; font-size: 22px; }\n.dialog-actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 34px; }\n.dialog-actions button { font-size: 22px; padding: 17px 28px; }\n\n.controller-body { min-height: 100vh; padding: 24px; }\n.controller-shell { width: min(760px, 100%); margin: 0 auto; }\n.controller-header { margin-bottom: 24px; }\n.controller-card { padding: clamp(24px, 5vw, 46px); border-radius: 28px; background: rgba(255,255,255,0.075); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 30px 80px rgba(0,0,0,0.22); }\n.controller-card h1 { margin: 0; font-size: clamp(38px, 8vw, 64px); line-height: 1; letter-spacing: -0.05em; }\n.controller-card h2 { margin: 0 0 18px; }\n.controller-card p { color: #bdbdc8; line-height: 1.55; }\n.controller-card label { display: block; margin: 20px 0 8px; color: #d7d7de; font-weight: 800; }\n.controller-card input { width: 100%; border: 1px solid rgba(255,255,255,0.13); border-radius: 15px; background: rgba(0,0,0,0.22); color: white; padding: 15px 17px; outline: none; }\n.controller-card input:focus { border-color: #9279ff; box-shadow: 0 0 0 4px rgba(115,81,255,0.2); }\n.code-input { font-size: 38px; text-align: center; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }\n.wide { width: 100%; margin-top: 18px; }\n.inline-status { min-height: 24px; font-weight: 700; }\n.button-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }\n.form-divider { height: 1px; background: rgba(255,255,255,0.12); margin: 34px 0; }\n\n@media (max-width: 850px) {\n  .pairing-screen { grid-template-columns: 1fr; text-align: center; overflow: auto; }\n  .pairing-copy .lead, .bookmark-hint { margin-left: auto; margin-right: auto; }\n  .qr-card canvas { width: min(62vw, 320px); height: min(62vw, 320px); }\n  .topbar-actions .ghost-button { display: none; }\n  .reveal-card { flex-direction: column; text-align: center; }\n}\n"],"/tv.js":["text/javascript; charset=utf-8","var Qt=Object.create;var $e=Object.defineProperty;var Wt=Object.getOwnPropertyDescriptor;var Xt=Object.getOwnPropertyNames;var Zt=Object.getPrototypeOf,en=Object.prototype.hasOwnProperty;var h=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var tn=(t,e,n,r)=>{if(e&&typeof e==\"object\"||typeof e==\"function\")for(let o of Xt(e))!en.call(t,o)&&o!==n&&$e(t,o,{get:()=>e[o],enumerable:!(r=Wt(e,o))||r.enumerable});return t};var nn=(t,e,n)=>(n=t!=null?Qt(Zt(t)):{},tn(e||!t||!t.__esModule?$e(n,\"default\",{value:t,enumerable:!0}):n,t));var Je=h((rr,Ke)=>{Ke.exports=function(){return typeof Promise==\"function\"&&Promise.prototype&&Promise.prototype.then}});var I=h(q=>{var me,rn=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];q.getSymbolSize=function(e){if(!e)throw new Error('\"version\" cannot be null or undefined');if(e<1||e>40)throw new Error('\"version\" should be in range from 1 to 40');return e*4+17};q.getSymbolTotalCodewords=function(e){return rn[e]};q.getBCHDigit=function(t){let e=0;for(;t!==0;)e++,t>>>=1;return e};q.setToSJISFunction=function(e){if(typeof e!=\"function\")throw new Error('\"toSJISFunc\" is not a valid function.');me=e};q.isKanjiModeEnabled=function(){return typeof me!=\"undefined\"};q.toSJIS=function(e){return me(e)}});var ee=h(C=>{C.L={bit:1};C.M={bit:0};C.Q={bit:3};C.H={bit:2};function on(t){if(typeof t!=\"string\")throw new Error(\"Param is not a string\");switch(t.toLowerCase()){case\"l\":case\"low\":return C.L;case\"m\":case\"medium\":return C.M;case\"q\":case\"quartile\":return C.Q;case\"h\":case\"high\":return C.H;default:throw new Error(\"Unknown EC Level: \"+t)}}C.isValid=function(e){return e&&typeof e.bit!=\"undefined\"&&e.bit>=0&&e.bit<4};C.from=function(e,n){if(C.isValid(e))return e;try{return on(e)}catch(r){return n}}});var je=h((sr,Ye)=>{function Oe(){this.buffer=[],this.length=0}Oe.prototype={get:function(t){let e=Math.floor(t/8);return(this.buffer[e]>>>7-t%8&1)===1},put:function(t,e){for(let n=0;n<e;n++)this.putBit((t>>>e-n-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(t){let e=Math.floor(this.length/8);this.buffer.length<=e&&this.buffer.push(0),t&&(this.buffer[e]|=128>>>this.length%8),this.length++}};Ye.exports=Oe});var Qe=h((ar,Ge)=>{function O(t){if(!t||t<1)throw new Error(\"BitMatrix size must be defined and greater than 0\");this.size=t,this.data=new Uint8Array(t*t),this.reservedBit=new Uint8Array(t*t)}O.prototype.set=function(t,e,n,r){let o=t*this.size+e;this.data[o]=n,r&&(this.reservedBit[o]=!0)};O.prototype.get=function(t,e){return this.data[t*this.size+e]};O.prototype.xor=function(t,e,n){this.data[t*this.size+e]^=n};O.prototype.isReserved=function(t,e){return this.reservedBit[t*this.size+e]};Ge.exports=O});var We=h(te=>{var sn=I().getSymbolSize;te.getRowColCoords=function(e){if(e===1)return[];let n=Math.floor(e/7)+2,r=sn(e),o=r===145?26:Math.ceil((r-13)/(2*n-2))*2,i=[r-7];for(let s=1;s<n-1;s++)i[s]=i[s-1]-o;return i.push(6),i.reverse()};te.getPositions=function(e){let n=[],r=te.getRowColCoords(e),o=r.length;for(let i=0;i<o;i++)for(let s=0;s<o;s++)i===0&&s===0||i===0&&s===o-1||i===o-1&&s===0||n.push([r[i],r[s]]);return n}});var et=h(Ze=>{var an=I().getSymbolSize,Xe=7;Ze.getPositions=function(e){let n=an(e);return[[0,0],[n-Xe,0],[0,n-Xe]]}});var tt=h(m=>{m.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};var D={N1:3,N2:3,N3:40,N4:10};m.isValid=function(e){return e!=null&&e!==\"\"&&!isNaN(e)&&e>=0&&e<=7};m.from=function(e){return m.isValid(e)?parseInt(e,10):void 0};m.getPenaltyN1=function(e){let n=e.size,r=0,o=0,i=0,s=null,a=null;for(let u=0;u<n;u++){o=i=0,s=a=null;for(let c=0;c<n;c++){let d=e.get(u,c);d===s?o++:(o>=5&&(r+=D.N1+(o-5)),s=d,o=1),d=e.get(c,u),d===a?i++:(i>=5&&(r+=D.N1+(i-5)),a=d,i=1)}o>=5&&(r+=D.N1+(o-5)),i>=5&&(r+=D.N1+(i-5))}return r};m.getPenaltyN2=function(e){let n=e.size,r=0;for(let o=0;o<n-1;o++)for(let i=0;i<n-1;i++){let s=e.get(o,i)+e.get(o,i+1)+e.get(o+1,i)+e.get(o+1,i+1);(s===4||s===0)&&r++}return r*D.N2};m.getPenaltyN3=function(e){let n=e.size,r=0,o=0,i=0;for(let s=0;s<n;s++){o=i=0;for(let a=0;a<n;a++)o=o<<1&2047|e.get(s,a),a>=10&&(o===1488||o===93)&&r++,i=i<<1&2047|e.get(a,s),a>=10&&(i===1488||i===93)&&r++}return r*D.N3};m.getPenaltyN4=function(e){let n=0,r=e.data.length;for(let i=0;i<r;i++)n+=e.data[i];return Math.abs(Math.ceil(n*100/r/5)-10)*D.N4};function un(t,e,n){switch(t){case m.Patterns.PATTERN000:return(e+n)%2===0;case m.Patterns.PATTERN001:return e%2===0;case m.Patterns.PATTERN010:return n%3===0;case m.Patterns.PATTERN011:return(e+n)%3===0;case m.Patterns.PATTERN100:return(Math.floor(e/2)+Math.floor(n/3))%2===0;case m.Patterns.PATTERN101:return e*n%2+e*n%3===0;case m.Patterns.PATTERN110:return(e*n%2+e*n%3)%2===0;case m.Patterns.PATTERN111:return(e*n%3+(e+n)%2)%2===0;default:throw new Error(\"bad maskPattern:\"+t)}}m.applyMask=function(e,n){let r=n.size;for(let o=0;o<r;o++)for(let i=0;i<r;i++)n.isReserved(i,o)||n.xor(i,o,un(e,i,o))};m.getBestMask=function(e,n){let r=Object.keys(m.Patterns).length,o=0,i=1/0;for(let s=0;s<r;s++){n(s),m.applyMask(s,e);let a=m.getPenaltyN1(e)+m.getPenaltyN2(e)+m.getPenaltyN3(e)+m.getPenaltyN4(e);m.applyMask(s,e),a<i&&(i=a,o=s)}return o}});var we=h(pe=>{var L=ee(),ne=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],re=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];pe.getBlocksCount=function(e,n){switch(n){case L.L:return ne[(e-1)*4+0];case L.M:return ne[(e-1)*4+1];case L.Q:return ne[(e-1)*4+2];case L.H:return ne[(e-1)*4+3];default:return}};pe.getTotalCodewordsCount=function(e,n){switch(n){case L.L:return re[(e-1)*4+0];case L.M:return re[(e-1)*4+1];case L.Q:return re[(e-1)*4+2];case L.H:return re[(e-1)*4+3];default:return}}});var nt=h(ie=>{var Y=new Uint8Array(512),oe=new Uint8Array(256);(function(){let e=1;for(let n=0;n<255;n++)Y[n]=e,oe[e]=n,e<<=1,e&256&&(e^=285);for(let n=255;n<512;n++)Y[n]=Y[n-255]})();ie.log=function(e){if(e<1)throw new Error(\"log(\"+e+\")\");return oe[e]};ie.exp=function(e){return Y[e]};ie.mul=function(e,n){return e===0||n===0?0:Y[oe[e]+oe[n]]}});var rt=h(j=>{var ye=nt();j.mul=function(e,n){let r=new Uint8Array(e.length+n.length-1);for(let o=0;o<e.length;o++)for(let i=0;i<n.length;i++)r[o+i]^=ye.mul(e[o],n[i]);return r};j.mod=function(e,n){let r=new Uint8Array(e);for(;r.length-n.length>=0;){let o=r[0];for(let s=0;s<n.length;s++)r[s]^=ye.mul(n[s],o);let i=0;for(;i<r.length&&r[i]===0;)i++;r=r.slice(i)}return r};j.generateECPolynomial=function(e){let n=new Uint8Array([1]);for(let r=0;r<e;r++)n=j.mul(n,new Uint8Array([1,ye.exp(r)]));return n}});var st=h((hr,it)=>{var ot=rt();function Ee(t){this.genPoly=void 0,this.degree=t,this.degree&&this.initialize(this.degree)}Ee.prototype.initialize=function(e){this.degree=e,this.genPoly=ot.generateECPolynomial(this.degree)};Ee.prototype.encode=function(e){if(!this.genPoly)throw new Error(\"Encoder not initialized\");let n=new Uint8Array(e.length+this.degree);n.set(e);let r=ot.mod(n,this.genPoly),o=this.degree-r.length;if(o>0){let i=new Uint8Array(this.degree);return i.set(r,o),i}return r};it.exports=Ee});var Ce=h(at=>{at.isValid=function(e){return!isNaN(e)&&e>=1&&e<=40}});var be=h(N=>{var ut=\"[0-9]+\",ln=\"[A-Z $%*+\\\\-./:]+\",G=\"(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+\";G=G.replace(/u/g,\"\\\\u\");var cn=\"(?:(?![A-Z0-9 $%*+\\\\-./:]|\"+G+`)(?:.|[\\r\n]))+`;N.KANJI=new RegExp(G,\"g\");N.BYTE_KANJI=new RegExp(\"[^A-Z0-9 $%*+\\\\-./:]+\",\"g\");N.BYTE=new RegExp(cn,\"g\");N.NUMERIC=new RegExp(ut,\"g\");N.ALPHANUMERIC=new RegExp(ln,\"g\");var dn=new RegExp(\"^\"+G+\"$\"),fn=new RegExp(\"^\"+ut+\"$\"),gn=new RegExp(\"^[A-Z0-9 $%*+\\\\-./:]+$\");N.testKanji=function(e){return dn.test(e)};N.testNumeric=function(e){return fn.test(e)};N.testAlphanumeric=function(e){return gn.test(e)}});var P=h(p=>{var hn=Ce(),Te=be();p.NUMERIC={id:\"Numeric\",bit:1,ccBits:[10,12,14]};p.ALPHANUMERIC={id:\"Alphanumeric\",bit:2,ccBits:[9,11,13]};p.BYTE={id:\"Byte\",bit:4,ccBits:[8,16,16]};p.KANJI={id:\"Kanji\",bit:8,ccBits:[8,10,12]};p.MIXED={bit:-1};p.getCharCountIndicator=function(e,n){if(!e.ccBits)throw new Error(\"Invalid mode: \"+e);if(!hn.isValid(n))throw new Error(\"Invalid version: \"+n);return n>=1&&n<10?e.ccBits[0]:n<27?e.ccBits[1]:e.ccBits[2]};p.getBestModeForData=function(e){return Te.testNumeric(e)?p.NUMERIC:Te.testAlphanumeric(e)?p.ALPHANUMERIC:Te.testKanji(e)?p.KANJI:p.BYTE};p.toString=function(e){if(e&&e.id)return e.id;throw new Error(\"Invalid mode\")};p.isValid=function(e){return e&&e.bit&&e.ccBits};function mn(t){if(typeof t!=\"string\")throw new Error(\"Param is not a string\");switch(t.toLowerCase()){case\"numeric\":return p.NUMERIC;case\"alphanumeric\":return p.ALPHANUMERIC;case\"kanji\":return p.KANJI;case\"byte\":return p.BYTE;default:throw new Error(\"Unknown mode: \"+t)}}p.from=function(e,n){if(p.isValid(e))return e;try{return mn(e)}catch(r){return n}}});var gt=h(H=>{var se=I(),pn=we(),lt=ee(),k=P(),Se=Ce(),dt=7973,ct=se.getBCHDigit(dt);function wn(t,e,n){for(let r=1;r<=40;r++)if(e<=H.getCapacity(r,n,t))return r}function ft(t,e){return k.getCharCountIndicator(t,e)+4}function yn(t,e){let n=0;return t.forEach(function(r){let o=ft(r.mode,e);n+=o+r.getBitsLength()}),n}function En(t,e){for(let n=1;n<=40;n++)if(yn(t,n)<=H.getCapacity(n,e,k.MIXED))return n}H.from=function(e,n){return Se.isValid(e)?parseInt(e,10):n};H.getCapacity=function(e,n,r){if(!Se.isValid(e))throw new Error(\"Invalid QR Code version\");typeof r==\"undefined\"&&(r=k.BYTE);let o=se.getSymbolTotalCodewords(e),i=pn.getTotalCodewordsCount(e,n),s=(o-i)*8;if(r===k.MIXED)return s;let a=s-ft(r,e);switch(r){case k.NUMERIC:return Math.floor(a/10*3);case k.ALPHANUMERIC:return Math.floor(a/11*2);case k.KANJI:return Math.floor(a/13);case k.BYTE:default:return Math.floor(a/8)}};H.getBestVersionForData=function(e,n){let r,o=lt.from(n,lt.M);if(Array.isArray(e)){if(e.length>1)return En(e,o);if(e.length===0)return 1;r=e[0]}else r=e;return wn(r.mode,r.getLength(),o)};H.getEncodedBits=function(e){if(!Se.isValid(e)||e<7)throw new Error(\"Invalid QR Code version\");let n=e<<12;for(;se.getBCHDigit(n)-ct>=0;)n^=dt<<se.getBCHDigit(n)-ct;return e<<12|n}});var wt=h(pt=>{var Be=I(),mt=1335,Cn=21522,ht=Be.getBCHDigit(mt);pt.getEncodedBits=function(e,n){let r=e.bit<<3|n,o=r<<10;for(;Be.getBCHDigit(o)-ht>=0;)o^=mt<<Be.getBCHDigit(o)-ht;return(r<<10|o)^Cn}});var Et=h((Cr,yt)=>{var bn=P();function F(t){this.mode=bn.NUMERIC,this.data=t.toString()}F.getBitsLength=function(e){return 10*Math.floor(e/3)+(e%3?e%3*3+1:0)};F.prototype.getLength=function(){return this.data.length};F.prototype.getBitsLength=function(){return F.getBitsLength(this.data.length)};F.prototype.write=function(e){let n,r,o;for(n=0;n+3<=this.data.length;n+=3)r=this.data.substr(n,3),o=parseInt(r,10),e.put(o,10);let i=this.data.length-n;i>0&&(r=this.data.substr(n),o=parseInt(r,10),e.put(o,i*3+1))};yt.exports=F});var bt=h((br,Ct)=>{var Tn=P(),Me=[\"0\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"A\",\"B\",\"C\",\"D\",\"E\",\"F\",\"G\",\"H\",\"I\",\"J\",\"K\",\"L\",\"M\",\"N\",\"O\",\"P\",\"Q\",\"R\",\"S\",\"T\",\"U\",\"V\",\"W\",\"X\",\"Y\",\"Z\",\" \",\"$\",\"%\",\"*\",\"+\",\"-\",\".\",\"/\",\":\"];function V(t){this.mode=Tn.ALPHANUMERIC,this.data=t}V.getBitsLength=function(e){return 11*Math.floor(e/2)+6*(e%2)};V.prototype.getLength=function(){return this.data.length};V.prototype.getBitsLength=function(){return V.getBitsLength(this.data.length)};V.prototype.write=function(e){let n;for(n=0;n+2<=this.data.length;n+=2){let r=Me.indexOf(this.data[n])*45;r+=Me.indexOf(this.data[n+1]),e.put(r,11)}this.data.length%2&&e.put(Me.indexOf(this.data[n]),6)};Ct.exports=V});var St=h((Tr,Tt)=>{var Sn=P();function z(t){this.mode=Sn.BYTE,typeof t==\"string\"?this.data=new TextEncoder().encode(t):this.data=new Uint8Array(t)}z.getBitsLength=function(e){return e*8};z.prototype.getLength=function(){return this.data.length};z.prototype.getBitsLength=function(){return z.getBitsLength(this.data.length)};z.prototype.write=function(t){for(let e=0,n=this.data.length;e<n;e++)t.put(this.data[e],8)};Tt.exports=z});var Mt=h((Sr,Bt)=>{var Bn=P(),Mn=I();function $(t){this.mode=Bn.KANJI,this.data=t}$.getBitsLength=function(e){return e*13};$.prototype.getLength=function(){return this.data.length};$.prototype.getBitsLength=function(){return $.getBitsLength(this.data.length)};$.prototype.write=function(t){let e;for(e=0;e<this.data.length;e++){let n=Mn.toSJIS(this.data[e]);if(n>=33088&&n<=40956)n-=33088;else if(n>=57408&&n<=60351)n-=49472;else throw new Error(\"Invalid SJIS character: \"+this.data[e]+`\nMake sure your charset is UTF-8`);n=(n>>>8&255)*192+(n&255),t.put(n,13)}};Bt.exports=$});var At=h((Br,Ae)=>{\"use strict\";var Q={single_source_shortest_paths:function(t,e,n){var r={},o={};o[e]=0;var i=Q.PriorityQueue.make();i.push(e,0);for(var s,a,u,c,d,w,g,y,T;!i.empty();){s=i.pop(),a=s.value,c=s.cost,d=t[a]||{};for(u in d)d.hasOwnProperty(u)&&(w=d[u],g=c+w,y=o[u],T=typeof o[u]==\"undefined\",(T||y>g)&&(o[u]=g,i.push(u,g),r[u]=a))}if(typeof n!=\"undefined\"&&typeof o[n]==\"undefined\"){var S=[\"Could not find a path from \",e,\" to \",n,\".\"].join(\"\");throw new Error(S)}return r},extract_shortest_path_from_predecessor_list:function(t,e){for(var n=[],r=e,o;r;)n.push(r),o=t[r],r=t[r];return n.reverse(),n},find_path:function(t,e,n){var r=Q.single_source_shortest_paths(t,e,n);return Q.extract_shortest_path_from_predecessor_list(r,n)},PriorityQueue:{make:function(t){var e=Q.PriorityQueue,n={},r;t=t||{};for(r in e)e.hasOwnProperty(r)&&(n[r]=e[r]);return n.queue=[],n.sorter=t.sorter||e.default_sorter,n},default_sorter:function(t,e){return t.cost-e.cost},push:function(t,e){var n={value:t,cost:e};this.queue.push(n),this.queue.sort(this.sorter)},pop:function(){return this.queue.shift()},empty:function(){return this.queue.length===0}}};typeof Ae!=\"undefined\"&&(Ae.exports=Q)});var qt=h(K=>{var f=P(),Lt=Et(),Pt=bt(),kt=St(),xt=Mt(),W=be(),ae=I(),An=At();function Nt(t){return unescape(encodeURIComponent(t)).length}function X(t,e,n){let r=[],o;for(;(o=t.exec(n))!==null;)r.push({data:o[0],index:o.index,mode:e,length:o[0].length});return r}function Rt(t){let e=X(W.NUMERIC,f.NUMERIC,t),n=X(W.ALPHANUMERIC,f.ALPHANUMERIC,t),r,o;return ae.isKanjiModeEnabled()?(r=X(W.BYTE,f.BYTE,t),o=X(W.KANJI,f.KANJI,t)):(r=X(W.BYTE_KANJI,f.BYTE,t),o=[]),e.concat(n,r,o).sort(function(s,a){return s.index-a.index}).map(function(s){return{data:s.data,mode:s.mode,length:s.length}})}function Ne(t,e){switch(e){case f.NUMERIC:return Lt.getBitsLength(t);case f.ALPHANUMERIC:return Pt.getBitsLength(t);case f.KANJI:return xt.getBitsLength(t);case f.BYTE:return kt.getBitsLength(t)}}function Nn(t){return t.reduce(function(e,n){let r=e.length-1>=0?e[e.length-1]:null;return r&&r.mode===n.mode?(e[e.length-1].data+=n.data,e):(e.push(n),e)},[])}function In(t){let e=[];for(let n=0;n<t.length;n++){let r=t[n];switch(r.mode){case f.NUMERIC:e.push([r,{data:r.data,mode:f.ALPHANUMERIC,length:r.length},{data:r.data,mode:f.BYTE,length:r.length}]);break;case f.ALPHANUMERIC:e.push([r,{data:r.data,mode:f.BYTE,length:r.length}]);break;case f.KANJI:e.push([r,{data:r.data,mode:f.BYTE,length:Nt(r.data)}]);break;case f.BYTE:e.push([{data:r.data,mode:f.BYTE,length:Nt(r.data)}])}}return e}function Ln(t,e){let n={},r={start:{}},o=[\"start\"];for(let i=0;i<t.length;i++){let s=t[i],a=[];for(let u=0;u<s.length;u++){let c=s[u],d=\"\"+i+u;a.push(d),n[d]={node:c,lastCount:0},r[d]={};for(let w=0;w<o.length;w++){let g=o[w];n[g]&&n[g].node.mode===c.mode?(r[g][d]=Ne(n[g].lastCount+c.length,c.mode)-Ne(n[g].lastCount,c.mode),n[g].lastCount+=c.length):(n[g]&&(n[g].lastCount=c.length),r[g][d]=Ne(c.length,c.mode)+4+f.getCharCountIndicator(c.mode,e))}}o=a}for(let i=0;i<o.length;i++)r[o[i]].end=0;return{map:r,table:n}}function It(t,e){let n,r=f.getBestModeForData(t);if(n=f.from(e,r),n!==f.BYTE&&n.bit<r.bit)throw new Error('\"'+t+'\" cannot be encoded with mode '+f.toString(n)+`.\n Suggested mode is: `+f.toString(r));switch(n===f.KANJI&&!ae.isKanjiModeEnabled()&&(n=f.BYTE),n){case f.NUMERIC:return new Lt(t);case f.ALPHANUMERIC:return new Pt(t);case f.KANJI:return new xt(t);case f.BYTE:return new kt(t)}}K.fromArray=function(e){return e.reduce(function(n,r){return typeof r==\"string\"?n.push(It(r,null)):r.data&&n.push(It(r.data,r.mode)),n},[])};K.fromString=function(e,n){let r=Rt(e,ae.isKanjiModeEnabled()),o=In(r),i=Ln(o,n),s=An.find_path(i.map,\"start\",\"end\"),a=[];for(let u=1;u<s.length-1;u++)a.push(i.table[s[u]].node);return K.fromArray(Nn(a))};K.rawSplit=function(e){return K.fromArray(Rt(e,ae.isKanjiModeEnabled()))}});var Ht=h(Dt=>{var le=I(),Ie=ee(),Pn=je(),kn=Qe(),xn=We(),Rn=et(),ke=tt(),xe=we(),qn=st(),ue=gt(),Dn=wt(),Hn=P(),Le=qt();function _n(t,e){let n=t.size,r=Rn.getPositions(e);for(let o=0;o<r.length;o++){let i=r[o][0],s=r[o][1];for(let a=-1;a<=7;a++)if(!(i+a<=-1||n<=i+a))for(let u=-1;u<=7;u++)s+u<=-1||n<=s+u||(a>=0&&a<=6&&(u===0||u===6)||u>=0&&u<=6&&(a===0||a===6)||a>=2&&a<=4&&u>=2&&u<=4?t.set(i+a,s+u,!0,!0):t.set(i+a,s+u,!1,!0))}}function vn(t){let e=t.size;for(let n=8;n<e-8;n++){let r=n%2===0;t.set(n,6,r,!0),t.set(6,n,r,!0)}}function Un(t,e){let n=xn.getPositions(e);for(let r=0;r<n.length;r++){let o=n[r][0],i=n[r][1];for(let s=-2;s<=2;s++)for(let a=-2;a<=2;a++)s===-2||s===2||a===-2||a===2||s===0&&a===0?t.set(o+s,i+a,!0,!0):t.set(o+s,i+a,!1,!0)}}function Fn(t,e){let n=t.size,r=ue.getEncodedBits(e),o,i,s;for(let a=0;a<18;a++)o=Math.floor(a/3),i=a%3+n-8-3,s=(r>>a&1)===1,t.set(o,i,s,!0),t.set(i,o,s,!0)}function Pe(t,e,n){let r=t.size,o=Dn.getEncodedBits(e,n),i,s;for(i=0;i<15;i++)s=(o>>i&1)===1,i<6?t.set(i,8,s,!0):i<8?t.set(i+1,8,s,!0):t.set(r-15+i,8,s,!0),i<8?t.set(8,r-i-1,s,!0):i<9?t.set(8,15-i-1+1,s,!0):t.set(8,15-i-1,s,!0);t.set(r-8,8,1,!0)}function Vn(t,e){let n=t.size,r=-1,o=n-1,i=7,s=0;for(let a=n-1;a>0;a-=2)for(a===6&&a--;;){for(let u=0;u<2;u++)if(!t.isReserved(o,a-u)){let c=!1;s<e.length&&(c=(e[s]>>>i&1)===1),t.set(o,a-u,c),i--,i===-1&&(s++,i=7)}if(o+=r,o<0||n<=o){o-=r,r=-r;break}}}function zn(t,e,n){let r=new Pn;n.forEach(function(u){r.put(u.mode.bit,4),r.put(u.getLength(),Hn.getCharCountIndicator(u.mode,t)),u.write(r)});let o=le.getSymbolTotalCodewords(t),i=xe.getTotalCodewordsCount(t,e),s=(o-i)*8;for(r.getLengthInBits()+4<=s&&r.put(0,4);r.getLengthInBits()%8!==0;)r.putBit(0);let a=(s-r.getLengthInBits())/8;for(let u=0;u<a;u++)r.put(u%2?17:236,8);return $n(r,t,e)}function $n(t,e,n){let r=le.getSymbolTotalCodewords(e),o=xe.getTotalCodewordsCount(e,n),i=r-o,s=xe.getBlocksCount(e,n),a=r%s,u=s-a,c=Math.floor(r/s),d=Math.floor(i/s),w=d+1,g=c-d,y=new qn(g),T=0,S=new Array(s),J=new Array(s),B=0,R=new Uint8Array(t.buffer);for(let U=0;U<s;U++){let he=U<u?d:w;S[U]=R.slice(T,T+he),J[U]=y.encode(S[U]),T+=he,B=Math.max(B,he)}let ge=new Uint8Array(r),ze=0,M,A;for(M=0;M<B;M++)for(A=0;A<s;A++)M<S[A].length&&(ge[ze++]=S[A][M]);for(M=0;M<g;M++)for(A=0;A<s;A++)ge[ze++]=J[A][M];return ge}function Kn(t,e,n,r){let o;if(Array.isArray(t))o=Le.fromArray(t);else if(typeof t==\"string\"){let c=e;if(!c){let d=Le.rawSplit(t);c=ue.getBestVersionForData(d,n)}o=Le.fromString(t,c||40)}else throw new Error(\"Invalid data\");let i=ue.getBestVersionForData(o,n);if(!i)throw new Error(\"The amount of data is too big to be stored in a QR Code\");if(!e)e=i;else if(e<i)throw new Error(`\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: `+i+`.\n`);let s=zn(e,n,o),a=le.getSymbolSize(e),u=new kn(a);return _n(u,e),vn(u),Un(u,e),Pe(u,n,0),e>=7&&Fn(u,e),Vn(u,s),isNaN(r)&&(r=ke.getBestMask(u,Pe.bind(null,u,n))),ke.applyMask(r,u),Pe(u,n,r),{modules:u,version:e,errorCorrectionLevel:n,maskPattern:r,segments:o}}Dt.create=function(e,n){if(typeof e==\"undefined\"||e===\"\")throw new Error(\"No input text\");let r=Ie.M,o,i;return typeof n!=\"undefined\"&&(r=Ie.from(n.errorCorrectionLevel,Ie.M),o=ue.from(n.version),i=ke.from(n.maskPattern),n.toSJISFunc&&le.setToSJISFunction(n.toSJISFunc)),Kn(e,o,r,i)}});var Re=h(_=>{function _t(t){if(typeof t==\"number\"&&(t=t.toString()),typeof t!=\"string\")throw new Error(\"Color should be defined as hex string\");let e=t.slice().replace(\"#\",\"\").split(\"\");if(e.length<3||e.length===5||e.length>8)throw new Error(\"Invalid hex color: \"+t);(e.length===3||e.length===4)&&(e=Array.prototype.concat.apply([],e.map(function(r){return[r,r]}))),e.length===6&&e.push(\"F\",\"F\");let n=parseInt(e.join(\"\"),16);return{r:n>>24&255,g:n>>16&255,b:n>>8&255,a:n&255,hex:\"#\"+e.slice(0,6).join(\"\")}}_.getOptions=function(e){e||(e={}),e.color||(e.color={});let n=typeof e.margin==\"undefined\"||e.margin===null||e.margin<0?4:e.margin,r=e.width&&e.width>=21?e.width:void 0,o=e.scale||4;return{width:r,scale:r?4:o,margin:n,color:{dark:_t(e.color.dark||\"#000000ff\"),light:_t(e.color.light||\"#ffffffff\")},type:e.type,rendererOpts:e.rendererOpts||{}}};_.getScale=function(e,n){return n.width&&n.width>=e+n.margin*2?n.width/(e+n.margin*2):n.scale};_.getImageWidth=function(e,n){let r=_.getScale(e,n);return Math.floor((e+n.margin*2)*r)};_.qrToImageData=function(e,n,r){let o=n.modules.size,i=n.modules.data,s=_.getScale(o,r),a=Math.floor((o+r.margin*2)*s),u=r.margin*s,c=[r.color.light,r.color.dark];for(let d=0;d<a;d++)for(let w=0;w<a;w++){let g=(d*a+w)*4,y=r.color.light;if(d>=u&&w>=u&&d<a-u&&w<a-u){let T=Math.floor((d-u)/s),S=Math.floor((w-u)/s);y=c[i[T*o+S]?1:0]}e[g++]=y.r,e[g++]=y.g,e[g++]=y.b,e[g]=y.a}}});var vt=h(ce=>{var qe=Re();function Jn(t,e,n){t.clearRect(0,0,e.width,e.height),e.style||(e.style={}),e.height=n,e.width=n,e.style.height=n+\"px\",e.style.width=n+\"px\"}function On(){try{return document.createElement(\"canvas\")}catch(t){throw new Error(\"You need to specify a canvas element\")}}ce.render=function(e,n,r){let o=r,i=n;typeof o==\"undefined\"&&(!n||!n.getContext)&&(o=n,n=void 0),n||(i=On()),o=qe.getOptions(o);let s=qe.getImageWidth(e.modules.size,o),a=i.getContext(\"2d\"),u=a.createImageData(s,s);return qe.qrToImageData(u.data,e,o),Jn(a,i,s),a.putImageData(u,0,0),i};ce.renderToDataURL=function(e,n,r){let o=r;typeof o==\"undefined\"&&(!n||!n.getContext)&&(o=n,n=void 0),o||(o={});let i=ce.render(e,n,o),s=o.type||\"image/png\",a=o.rendererOpts||{};return i.toDataURL(s,a.quality)}});var Vt=h(Ft=>{var Yn=Re();function Ut(t,e){let n=t.a/255,r=e+'=\"'+t.hex+'\"';return n<1?r+\" \"+e+'-opacity=\"'+n.toFixed(2).slice(1)+'\"':r}function De(t,e,n){let r=t+e;return typeof n!=\"undefined\"&&(r+=\" \"+n),r}function jn(t,e,n){let r=\"\",o=0,i=!1,s=0;for(let a=0;a<t.length;a++){let u=Math.floor(a%e),c=Math.floor(a/e);!u&&!i&&(i=!0),t[a]?(s++,a>0&&u>0&&t[a-1]||(r+=i?De(\"M\",u+n,.5+c+n):De(\"m\",o,0),o=0,i=!1),u+1<e&&t[a+1]||(r+=De(\"h\",s),s=0)):o++}return r}Ft.render=function(e,n,r){let o=Yn.getOptions(n),i=e.modules.size,s=e.modules.data,a=i+o.margin*2,u=o.color.light.a?\"<path \"+Ut(o.color.light,\"fill\")+' d=\"M0 0h'+a+\"v\"+a+'H0z\"/>':\"\",c=\"<path \"+Ut(o.color.dark,\"stroke\")+' d=\"'+jn(s,i,o.margin)+'\"/>',d='viewBox=\"0 0 '+a+\" \"+a+'\"',g='<svg xmlns=\"http://www.w3.org/2000/svg\" '+(o.width?'width=\"'+o.width+'\" height=\"'+o.width+'\" ':\"\")+d+' shape-rendering=\"crispEdges\">'+u+c+`</svg>\n`;return typeof r==\"function\"&&r(null,g),g}});var $t=h(Z=>{var Gn=Je(),He=Ht(),zt=vt(),Qn=Vt();function _e(t,e,n,r,o){let i=[].slice.call(arguments,1),s=i.length,a=typeof i[s-1]==\"function\";if(!a&&!Gn())throw new Error(\"Callback required as last argument\");if(a){if(s<2)throw new Error(\"Too few arguments provided\");s===2?(o=n,n=e,e=r=void 0):s===3&&(e.getContext&&typeof o==\"undefined\"?(o=r,r=void 0):(o=r,r=n,n=e,e=void 0))}else{if(s<1)throw new Error(\"Too few arguments provided\");return s===1?(n=e,e=r=void 0):s===2&&!e.getContext&&(r=n,n=e,e=void 0),new Promise(function(u,c){try{let d=He.create(n,r);u(t(d,e,r))}catch(d){c(d)}})}try{let u=He.create(n,r);o(null,t(u,e,r))}catch(u){o(u)}}Z.create=He.create;Z.toCanvas=_e.bind(null,zt.render);Z.toDataURL=_e.bind(null,zt.renderToDataURL);Z.toString=_e.bind(null,function(t,e,n){return Qn.render(t,n)})});var Yt=nn($t());async function Wn(t){let e=await t.json().catch(()=>({error:`HTTP ${t.status}`}));if(!t.ok)throw new Error(typeof e.error==\"string\"?e.error:`HTTP ${t.status}`);return e}async function de(t,e={}){return Wn(await fetch(t,{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify(e),cache:\"no-store\"}))}function Kt(t){return t.replace(/(\\d{3})(\\d{3})/u,\"$1 $2\")}function Jt(){\"serviceWorker\"in navigator&&location.protocol===\"https:\"&&navigator.serviceWorker.register(\"/sw.js\").catch(()=>{})}var l={pairing:document.querySelector(\"#pairing\"),game:document.querySelector(\"#game\"),code:document.querySelector(\"#room-code\"),qr:document.querySelector(\"#qr-code\"),connection:document.querySelector(\"#connection-status\"),pairingHint:document.querySelector(\"#pairing-hint\"),claimDialog:document.querySelector(\"#claim-dialog\"),claimText:document.querySelector(\"#claim-text\"),approve:document.querySelector(\"#approve-claim\"),deny:document.querySelector(\"#deny-claim\"),fullscreen:document.querySelector(\"#fullscreen\"),title:document.querySelector(\"#game-title\"),eyebrow:document.querySelector(\"#eyebrow\"),headline:document.querySelector(\"#headline\"),subline:document.querySelector(\"#subline\"),progress:document.querySelector(\"#progress\"),progressBar:document.querySelector(\"#progress-bar\"),reveal:document.querySelector(\"#reveal\"),song:document.querySelector(\"#song-title\"),artist:document.querySelector(\"#artist\"),year:document.querySelector(\"#year\"),scoreboard:document.querySelector(\"#scoreboard\"),footer:document.querySelector(\"#footer-status\")},E=null,v=null,fe=!1,Ot=-1,ve=!1,Xn={phase:\"pairing\",gameTitle:\"Hitster\"};function x(t,e=\"idle\"){l.connection.textContent=t,l.connection.dataset.state=e}function Ve(t){l.pairing.hidden=!t,l.game.hidden=t}function b(t,e){t.textContent=e||\"\",t.hidden=!e}function Ue(t){var e;return((e=t.currentPlayer)==null?void 0:e.name)||\"Der n\\xE4chste Spieler\"}function Fe(t){var r,o;l.scoreboard.replaceChildren();let e=t.scoreboard||t.players||[];if(!e.length){l.scoreboard.hidden=!0;return}l.scoreboard.hidden=!1;let n=[...e].sort((i,s)=>{var a,u;return((a=i.rank)!=null?a:Number.MAX_SAFE_INTEGER)-((u=s.rank)!=null?u:Number.MAX_SAFE_INTEGER)});for(let[i,s]of n.entries()){let a=document.createElement(\"div\");a.className=\"score-row\";let u=(r=s.rank)!=null?r:i+1,c=document.createElement(\"span\");c.className=\"score-name\",c.textContent=`${u}. ${s.name}`;let d=document.createElement(\"strong\");d.textContent=`${(o=s.score)!=null?o:0}`,a.append(c,d),l.scoreboard.append(a)}}function Zn(t){var n,r,o,i,s,a,u,c,d,w,g,y,T,S,J;if(Xn=t,!fe&&t.phase===\"pairing\")return;Ve(!1),l.title.textContent=t.gameTitle||\"Hitster\",l.reveal.hidden=!0,l.scoreboard.hidden=!0,l.progress.hidden=!0,l.year.hidden=!0;let e=(n=t.round)!=null&&n.current?`Runde ${t.round.current}${t.round.total?` von ${t.round.total}`:\"\"}`:\"\";switch(b(l.eyebrow,e),b(l.subline,t.message),t.phase){case\"lobby\":l.headline.textContent=\"Das Spiel kann beginnen\",b(l.subline,t.message||`${(o=(r=t.players)==null?void 0:r.length)!=null?o:0} Spieler sind dabei`),Fe(t);break;case\"round_start\":l.headline.textContent=`${Ue(t)} ist an der Reihe`,b(l.subline,t.message||\"Bereit f\\xFCr den n\\xE4chsten Titel?\");break;case\"playing\":{l.headline.textContent=\"Welcher Titel ist das?\",b(l.subline,t.message||`${Ue(t)} h\\xF6rt zu`);let B=(s=(i=t.playback)==null?void 0:i.elapsedMs)!=null?s:0,R=(u=(a=t.playback)==null?void 0:a.durationMs)!=null?u:0;R>0&&(l.progress.hidden=!1,l.progressBar.style.width=`${Math.min(100,Math.max(0,B/R*100))}%`);break}case\"input\":l.headline.textContent=`${Ue(t)} gibt eine Antwort ein`,b(l.subline,t.message||\"Die Eingabe bleibt auf dem Handy privat\");break;case\"waiting\":{l.headline.textContent=\"Warte auf die Antworten\";let B=(d=(c=t.waiting)==null?void 0:c.answered)!=null?d:0,R=(g=(w=t.waiting)==null?void 0:w.total)!=null?g:0;b(l.subline,R?`${B} von ${R} Spielern sind fertig`:t.message||\"Noch einen Moment\");break}case\"reveal\":case\"points\":l.headline.textContent=t.phase===\"points\"?\"Punkte\":\"Die L\\xF6sung\",l.reveal.hidden=!1,l.song.textContent=((y=t.reveal)==null?void 0:y.title)||\"Unbekannter Titel\",l.artist.textContent=((T=t.reveal)==null?void 0:T.artist)||\"Unbekannter K\\xFCnstler\",(S=t.reveal)!=null&&S.year&&(l.year.hidden=!1,l.year.textContent=String(t.reveal.year)),(J=t.awardedPoints)!=null&&J.length&&b(l.subline,t.awardedPoints.map(B=>`${B.playerName||\"Spieler\"}: ${B.points>=0?\"+\":\"\"}${B.points}`).join(\" \\xB7 \"));break;case\"scoreboard\":case\"round_end\":l.headline.textContent=t.phase===\"round_end\"?\"Runde beendet\":\"Zwischenstand\",b(l.subline,t.message),Fe(t);break;case\"finished\":l.headline.textContent=\"Spiel beendet\",b(l.subline,t.message||\"Das ist das Endergebnis\"),Fe(t);break;case\"aborted\":l.headline.textContent=\"Spiel abgebrochen\",b(l.subline,t.message||\"Die laufende Runde wurde verworfen\");break;case\"disconnected\":l.headline.textContent=\"Verbindung unterbrochen\",b(l.subline,t.message||\"Die Verbindung wird automatisch wiederhergestellt\");break;default:l.headline.textContent=t.message||\"Hitster\"}l.footer.textContent=fe?\"Mit dem Haupthandy verbunden\":\"Warte auf das Haupthandy\"}function er(t,e){v===e&&!l.claimDialog.hidden||(v=e,l.claimText.textContent=`Mit \\u201E${t}\\u201C verbinden?`,l.claimDialog.hidden=!1,l.approve.focus())}function jt(){v=null,l.claimDialog.hidden=!0}async function Gt(){if(!(!E||ve)){ve=!0;try{let t=await get(`/api/session/${E.code}/view`,{viewerToken:E.viewerToken});fe=t.paired,t.pendingClaim&&er(t.pendingClaim.clientName,t.pendingClaim.id),t.version!==Ot&&(Ot=t.version,Zn(t.state)),fe?(Ve(!1),t.hostOnline?x(\"Verbunden\",\"ok\"):x(\"Haupthandy nicht erreichbar\",\"warn\")):x(\"Bereit zum Koppeln\",\"ok\")}catch(t){let e=t instanceof Error?t.message:\"Verbindung unterbrochen\";x(e,\"warn\")}finally{ve=!1,window.setTimeout(()=>void Gt(),1e3)}}}async function tr(){x(\"Sitzung wird erstellt \\u2026\",\"warn\");try{E=await de(\"/api/session\"),l.code.textContent=Kt(E.code);let t=new URL(\"/controller\",location.origin);t.hash=new URLSearchParams({code:E.code,pair:E.pairToken}).toString(),await Yt.default.toCanvas(l.qr,t.toString(),{width:360,margin:2,errorCorrectionLevel:\"M\",color:{dark:\"#111111\",light:\"#ffffff\"}}),l.pairingHint.textContent=\"QR-Code mit dem Haupthandy scannen oder den Code in der App eingeben.\",Gt()}catch(t){let e=t instanceof Error?t.message:\"Unbekannter Fehler\";x(\"Keine Verbindung\",\"error\"),l.pairingHint.textContent=`Die Sitzung konnte nicht erstellt werden: ${e}. Seite neu laden.`}}l.approve.addEventListener(\"click\",()=>{!E||!v||de(`/api/session/${E.code}/approve`,{viewerToken:E.viewerToken,claimId:v}).then(()=>{jt(),x(\"Verbindung wird best\\xE4tigt \\u2026\",\"warn\")}).catch(t=>x(t.message,\"error\"))});l.deny.addEventListener(\"click\",()=>{!E||!v||de(`/api/session/${E.code}/deny`,{viewerToken:E.viewerToken,claimId:v}).finally(jt)});l.fullscreen.addEventListener(\"click\",()=>{var t,e;(e=(t=document.documentElement).requestFullscreen)==null||e.call(t).catch(()=>{})});document.addEventListener(\"keydown\",t=>{!l.claimDialog.hidden&&(t.key===\"Enter\"||t.key===\" \")&&(t.preventDefault(),l.approve.click()),t.key.toLowerCase()===\"f\"&&l.fullscreen.click()});Jt();Ve(!0);tr();\n"],"/controller.js":["text/javascript; charset=utf-8","async function k(t){let e=await t.json().catch(()=>({error:`HTTP ${t.status}`}));if(!t.ok)throw new Error(typeof e.error==\"string\"?e.error:`HTTP ${t.status}`);return e}async function c(t,e={}){return k(await fetch(t,{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify(e),cache:\"no-store\"}))}function p(){\"serviceWorker\"in navigator&&location.protocol===\"https:\"&&navigator.serviceWorker.register(\"/sw.js\").catch(()=>{})}var r={pairing:document.querySelector(\"#controller-pairing\"),controls:document.querySelector(\"#controller-controls\"),codeInput:document.querySelector(\"#code-input\"),pairButton:document.querySelector(\"#pair-button\"),status:document.querySelector(\"#controller-status\"),socketStatus:document.querySelector(\"#socket-status\"),customTitle:document.querySelector(\"#custom-title\"),customArtist:document.querySelector(\"#custom-artist\"),customYear:document.querySelector(\"#custom-year\"),sendReveal:document.querySelector(\"#send-reveal\")},s=\"\",u=\"\",l=0,g=null,m=null,i=[{id:\"resa\",name:\"Resa\",score:7,rank:1},{id:\"max\",name:\"Max\",score:5,rank:2},{id:\"anna\",name:\"Anna\",score:3,rank:3}];function a(t,e=\"idle\"){r.status.textContent=t,r.status.dataset.state=e}function d(t,e=\"idle\"){r.socketStatus.textContent=t,r.socketStatus.dataset.state=e}function w(){return l+=1,l}async function o(t){if(!u){d(\"Nicht verbunden\",\"error\");return}try{let e=await c(`/api/session/${s}/state`,{hostToken:u,version:w(),state:t});l=Math.max(l,e.version||l),d(\"Mit dem Fernseher verbunden\",\"ok\")}catch(e){let n=e instanceof Error?e.message:\"\\xDCbertragung fehlgeschlagen\";d(n,\"error\")}}function S(){m!==null&&window.clearInterval(m),m=window.setInterval(()=>{u&&c(`/api/session/${s}/heartbeat`,{hostToken:u}).catch(()=>{})},1e4)}function v(){r.pairing.hidden=!0,r.controls.hidden=!1,d(\"Mit dem Fernseher verbunden\",\"ok\"),S(),o({phase:\"lobby\",gameTitle:\"Hitster\",message:\"Teststeuerung ist verbunden\",players:i,scoreboard:i})}async function E(t){a(\"QR-Verbindung wird hergestellt \\u2026\",\"warn\"),u=(await c(`/api/session/${s}/claim-qr`,{pairToken:t})).hostToken,history.replaceState(null,\"\",location.pathname),v()}async function y(t){try{let e=await c(`/api/session/${s}/claim-status`,{claimId:t});if(e.status===\"pending\"){g=window.setTimeout(()=>void y(t),1200);return}if(e.status===\"approved\"&&e.hostToken){u=e.hostToken,a(\"Am Fernseher best\\xE4tigt\",\"ok\"),v();return}a(\"Verbindung am Fernseher abgelehnt\",\"error\")}catch(e){let n=e instanceof Error?e.message:\"Verbindung fehlgeschlagen\";a(n,\"error\")}}async function f(){if(s=r.codeInput.value.replace(/\\D/gu,\"\").slice(0,6),r.codeInput.value=s,!/^\\d{6}$/u.test(s)){a(\"Bitte den sechsstelligen Code eingeben\",\"error\");return}a(\"Bitte die Verbindung am Fernseher best\\xE4tigen\",\"warn\");let t=await c(`/api/session/${s}/request-code`,{clientName:\"Hitster-Teststeuerung\"});g!==null&&window.clearTimeout(g),await y(t.claimId)}r.pairButton.addEventListener(\"click\",()=>void f());r.codeInput.addEventListener(\"keydown\",t=>{t.key===\"Enter\"&&f()});document.querySelectorAll(\"[data-demo]\").forEach(t=>{t.addEventListener(\"click\",()=>{let e=t.dataset.demo,n={gameTitle:\"Hitster\",round:{current:3,total:10},players:i};e===\"lobby\"&&o({...n,phase:\"lobby\",message:\"3 Spieler sind bereit\",scoreboard:i}),e===\"round\"&&o({...n,phase:\"round_start\",currentPlayer:i[0],message:\"Bereit f\\xFCr den n\\xE4chsten Titel?\"}),e===\"playing\"&&o({...n,phase:\"playing\",currentPlayer:i[0],playback:{status:\"playing\",elapsedMs:12e3,durationMs:3e4}}),e===\"input\"&&o({...n,phase:\"input\",currentPlayer:i[0],message:\"Die Eingabe bleibt auf dem Handy privat\"}),e===\"waiting\"&&o({...n,phase:\"waiting\",waiting:{answered:2,total:3}}),e===\"scoreboard\"&&o({...n,phase:\"scoreboard\",message:\"Zwischenstand nach Runde 3\",scoreboard:i}),e===\"finished\"&&o({...n,phase:\"finished\",message:\"Endergebnis\",scoreboard:i})})});r.sendReveal.addEventListener(\"click\",()=>{let t=Number.parseInt(r.customYear.value,10);o({phase:\"reveal\",gameTitle:\"Hitster\",round:{current:3,total:10},reveal:{title:r.customTitle.value||\"Dancing Queen\",artist:r.customArtist.value||\"ABBA\",year:Number.isFinite(t)?t:1976},awardedPoints:[{playerName:\"Resa\",points:3,details:[\"Titel\",\"K\\xFCnstler\",\"Jahr\"]}]})});p();var T=new URLSearchParams(location.hash.slice(1)),h=T.get(\"code\")||\"\",b=T.get(\"pair\")||\"\";/^\\d{6}$/u.test(h)&&b&&(s=h,r.codeInput.value=s,E(b).catch(t=>{let e=t instanceof Error?t.message:\"QR-Verbindung fehlgeschlagen\";a(e,\"error\")}));\n"],"/manifest.webmanifest":["application/manifest+json; charset=utf-8","{\n  \"name\": \"Hitster TV\",\n  \"short_name\": \"Hitster TV\",\n  \"start_url\": \"/\",\n  \"display\": \"fullscreen\",\n  \"background_color\": \"#101014\",\n  \"theme_color\": \"#101014\",\n  \"icons\": []\n}\n"],"/sw.js":["text/javascript; charset=utf-8","const CACHE = \"hitster-tv-v1\";\nconst ASSETS = [\"/\", \"/index.html\", \"/controller\", \"/controller.html\", \"/styles.css\", \"/tv.js\", \"/controller.js\", \"/manifest.webmanifest\"];\n\nself.addEventListener(\"install\", (event) => {\n  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));\n});\n\nself.addEventListener(\"activate\", (event) => {\n  event.waitUntil(\n    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),\n  );\n});\n\nself.addEventListener(\"fetch\", (event) => {\n  const url = new URL(event.request.url);\n  if (event.request.method !== \"GET\" || url.origin !== self.location.origin) return;\n  event.respondWith(\n    fetch(event.request)\n      .then((response) => {\n        const copy = response.clone();\n        caches.open(CACHE).then((cache) => cache.put(event.request, copy));\n        return response;\n      })\n      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(\"/\"))),\n  );\n});\n"]};

const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
const PAIR_LIFETIME_MS = 10 * 60 * 1000;
const CLAIM_LIFETIME_MS = 2 * 60 * 1000;
const HOST_ONLINE_MS = 35 * 1000;
const MAX_STATE_BYTES = 32 * 1024;
const DEFAULT_STATE = { schemaVersion: 1, phase: "pairing", gameTitle: "Hitster", message: "Warte auf das Haupthandy" };
const ALLOWED_PHASES = new Set([
  "pairing", "lobby", "round_start", "playing", "input", "waiting", "reveal", "points",
  "scoreboard", "round_end", "finished", "aborted", "disconnected"
]);

let schemaPromise;

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function error(message, status = 400, details) {
  return json({ ok: false, error: message, details }, { status });
}

function securityHeaders(headers = new Headers()) {
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'");
  return headers;
}

function assetResponse(path) {
  const asset = ASSETS[path];
  if (!asset) return null;
  const [contentType, body] = asset;
  const headers = securityHeaders(new Headers());
  headers.set("content-type", contentType);
  headers.set("cache-control", path === "/sw.js" ? "no-cache" : "public, max-age=300");
  return new Response(body, { headers });
}

async function ensureSchema(db) {
  if (!schemaPromise) {
    const createTable = `CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      viewer_hash TEXT NOT NULL,
      pair_hash TEXT,
      host_hash TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      pair_expires_at INTEGER NOT NULL,
      paired INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL,
      pending_claim_id TEXT,
      pending_claim_name TEXT,
      pending_claim_expires_at INTEGER,
      pending_claim_status TEXT,
      pending_host_token TEXT,
      host_last_seen INTEGER NOT NULL DEFAULT 0
    )`;
    schemaPromise = db.batch([
      db.prepare(createTable),
      db.prepare("CREATE INDEX IF NOT EXISTS rooms_expiry_idx ON rooms(expires_at)")
    ]).catch((caught) => { schemaPromise = undefined; throw caught; });
  }
  return schemaPromise;
}

function randomDigits() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function tokenMatches(candidate, expectedHash) {
  if (typeof candidate !== "string" || candidate.length < 20 || candidate.length > 200 || !expectedHash) return false;
  return constantTimeEqual(expectedHash, await hashToken(candidate));
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/gu, " ").trim();
  return cleaned.slice(0, maxLength);
}

function cleanInteger(value, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function cleanNumber(value, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function cleanPlayer(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const name = cleanText(value.name, 40);
  if (!name) return undefined;
  const output = { name };
  const id = cleanText(value.id, 64);
  const rawStatus = cleanText(value.status, 24);
  const status = rawStatus && new Set(["ready", "active", "answered", "waiting", "offline"]).has(rawStatus) ? rawStatus : undefined;
  const score = cleanInteger(value.score, -9999, 999999);
  const rank = cleanInteger(value.rank, 1, 999);
  if (id) output.id = id;
  if (status) output.status = status;
  if (score !== undefined) output.score = score;
  if (rank !== undefined) output.rank = rank;
  return output;
}

function cleanPlayerArray(value, maxItems = 50) {
  if (!Array.isArray(value)) return undefined;
  const result = value.slice(0, maxItems).map(cleanPlayer).filter(Boolean);
  return result.length ? result : undefined;
}

function cleanStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return undefined;
  const result = value.slice(0, maxItems).map((item) => cleanText(item, maxLength)).filter(Boolean);
  return result.length ? result : undefined;
}

function sanitizeTvState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("state must be an object");
  const phase = cleanText(value.phase, 32);
  if (!phase || !ALLOWED_PHASES.has(phase)) throw new Error("unsupported phase");
  const output = { schemaVersion: 1, phase };

  const gameTitle = cleanText(value.gameTitle, 80);
  const message = cleanText(value.message, 180);
  const currentPlayer = cleanPlayer(value.currentPlayer);
  const players = cleanPlayerArray(value.players);
  const scoreboard = cleanPlayerArray(value.scoreboard);
  const listNames = cleanStringArray(value.listNames, 30, 80);
  if (gameTitle) output.gameTitle = gameTitle;
  if (message && phase !== "input" && phase !== "waiting") output.message = message;
  if (currentPlayer) output.currentPlayer = currentPlayer;
  if (players) output.players = players;
  if (scoreboard) output.scoreboard = scoreboard;
  if (listNames) output.listNames = listNames;

  if (value.round && typeof value.round === "object" && !Array.isArray(value.round)) {
    const current = cleanInteger(value.round.current, 0, 9999);
    const total = cleanInteger(value.round.total, 0, 9999);
    const round = {};
    if (current !== undefined) round.current = current;
    if (total !== undefined) round.total = total;
    if (Object.keys(round).length) output.round = round;
  }

  if (value.playback && typeof value.playback === "object" && !Array.isArray(value.playback)) {
    const status = cleanText(value.playback.status, 24);
    const elapsedMs = cleanInteger(value.playback.elapsedMs, 0, 86400000);
    const durationMs = cleanInteger(value.playback.durationMs, 0, 86400000);
    const playback = {};
    if (status) playback.status = status;
    if (elapsedMs !== undefined) playback.elapsedMs = elapsedMs;
    if (durationMs !== undefined) playback.durationMs = durationMs;
    if (Object.keys(playback).length) output.playback = playback;
  }

  if (value.waiting && typeof value.waiting === "object" && !Array.isArray(value.waiting)) {
    const answered = cleanInteger(value.waiting.answered, 0, 999);
    const total = cleanInteger(value.waiting.total, 0, 999);
    const waiting = {};
    if (answered !== undefined) waiting.answered = answered;
    if (total !== undefined) waiting.total = total;
    if (Object.keys(waiting).length) output.waiting = waiting;
  }

  if ((phase === "reveal" || phase === "points") && value.reveal && typeof value.reveal === "object" && !Array.isArray(value.reveal)) {
    const title = cleanText(value.reveal.title, 160);
    const artist = cleanText(value.reveal.artist, 160);
    const year = cleanInteger(value.reveal.year, 1000, 3000);
    const decade = cleanInteger(value.reveal.decade, 1000, 3000);
    const reveal = {};
    if (title) reveal.title = title;
    if (artist) reveal.artist = artist;
    if (year !== undefined) reveal.year = year;
    if (decade !== undefined) reveal.decade = decade;
    if (Object.keys(reveal).length) output.reveal = reveal;
  }

  if ((phase === "reveal" || phase === "points") && Array.isArray(value.awardedPoints)) {
    const allowedDetails = new Set(["Titel", "Künstler", "Jahr", "Jahrzehnt", "Song", "Artist", "Year", "Decade"]);
    const awardedPoints = value.awardedPoints.slice(0, 50).flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const playerId = cleanText(item.playerId, 64);
      const playerName = cleanText(item.playerName, 40);
      const points = cleanInteger(item.points, -100, 1000);
      const details = cleanStringArray(item.details, 10, 60)?.filter((detail) => allowedDetails.has(detail));
      if (points === undefined || (!playerId && !playerName)) return [];
      const result = { points };
      if (playerId) result.playerId = playerId;
      if (playerName) result.playerName = playerName;
      if (details?.length) result.details = details;
      return [result];
    });
    if (awardedPoints.length) output.awardedPoints = awardedPoints;
  }

  if (value.visual && typeof value.visual === "object" && !Array.isArray(value.visual)) {
    const progress = cleanNumber(value.visual.progress, 0, 1);
    if (progress !== undefined) output.visual = { progress };
  }

  const encoded = JSON.stringify(output);
  if (new TextEncoder().encode(encoded).byteLength > MAX_STATE_BYTES) throw new Error("state is too large");
  return output;
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("expected application/json");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid request body");
  return body;
}

function validCode(code) { return /^\d{6}$/u.test(code); }

async function getRoom(db, code) {
  return db.prepare("SELECT * FROM rooms WHERE code = ?").bind(code).first();
}

async function expirePendingClaim(db, room, now) {
  if (room.pending_claim_id && Number(room.pending_claim_expires_at || 0) <= now) {
    await db.prepare(`UPDATE rooms SET pending_claim_id = NULL, pending_claim_name = NULL, pending_claim_expires_at = NULL, pending_claim_status = NULL, pending_host_token = NULL WHERE code = ?`).bind(room.code).run();
    room.pending_claim_id = null;
    room.pending_claim_name = null;
    room.pending_claim_expires_at = null;
    room.pending_claim_status = null;
    room.pending_host_token = null;
  }
}

async function handleApi(request, env, url) {
  await ensureSchema(env.DB);
  const now = Date.now();

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, service: "hitster-tv-mobile", protocolVersion: 1, transport: "polling" });
  }

  if (url.pathname === "/api/session" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM rooms WHERE expires_at <= ?").bind(now).run();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = randomDigits();
      const viewerToken = randomToken();
      const pairToken = randomToken();
      const expiresAt = now + ROOM_LIFETIME_MS;
      const pairExpiresAt = now + PAIR_LIFETIME_MS;
      try {
        const result = await env.DB.prepare(`
          INSERT INTO rooms (code, viewer_hash, pair_hash, created_at, expires_at, pair_expires_at, paired, version, state_json, host_last_seen)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 0)
        `).bind(code, await hashToken(viewerToken), await hashToken(pairToken), now, expiresAt, pairExpiresAt, JSON.stringify(DEFAULT_STATE)).run();
        if (!result.success) continue;
        return json({ ok: true, code, viewerToken, pairToken, expiresAt, pairExpiresAt, protocolVersion: 1 });
      } catch (caught) {
        if (!String(caught).toLowerCase().includes("unique")) throw caught;
      }
    }
    return error("could not allocate room", 503);
  }

  const match = url.pathname.match(/^\/api\/session\/(\d{6})\/(claim-qr|request-code|claim-status|approve|deny|view|state|heartbeat)$/u);
  if (!match) return error("not found", 404);
  const [, code, action] = match;
  if (!validCode(code)) return error("invalid code", 400);
  if (request.method !== "POST") return error("method not allowed", 405);

  const body = await readBody(request);
  const room = await getRoom(env.DB, code);
  if (!room || Number(room.expires_at) <= now) return error("room expired", 410);
  await expirePendingClaim(env.DB, room, now);

  if (action === "claim-qr") {
    if (Number(room.paired)) return error("room already paired", 409);
    if (Number(room.pair_expires_at) <= now) return error("pairing token expired", 410);
    if (!(await tokenMatches(body.pairToken, room.pair_hash))) return error("invalid pairing token", 403);
    const hostToken = randomToken();
    await env.DB.prepare(`
      UPDATE rooms SET host_hash = ?, pair_hash = NULL, paired = 1, host_last_seen = ?,
      pending_claim_id = NULL, pending_claim_name = NULL, pending_claim_expires_at = NULL, pending_claim_status = NULL, pending_host_token = NULL
      WHERE code = ?
    `).bind(await hashToken(hostToken), now, code).run();
    return json({ ok: true, hostToken, expiresAt: Number(room.expires_at), protocolVersion: 1 });
  }

  if (action === "request-code") {
    if (Number(room.paired)) return error("room already paired", 409);
    const clientName = cleanText(body.clientName, 60) || "Haupthandy";
    const claimId = randomToken(18);
    const hostToken = randomToken();
    await env.DB.prepare(`
      UPDATE rooms SET pending_claim_id = ?, pending_claim_name = ?, pending_claim_expires_at = ?,
      pending_claim_status = 'pending', pending_host_token = ? WHERE code = ?
    `).bind(claimId, clientName, now + CLAIM_LIFETIME_MS, hostToken, code).run();
    return json({ ok: true, claimId, expiresAt: now + CLAIM_LIFETIME_MS });
  }

  if (action === "claim-status") {
    const claimId = typeof body.claimId === "string" ? body.claimId : "";
    if (!claimId || claimId !== room.pending_claim_id) return error("claim not found", 404);
    const status = room.pending_claim_status || "pending";
    if (status === "approved") {
      const hostToken = room.pending_host_token;
      await env.DB.prepare(`UPDATE rooms SET pending_claim_id = NULL, pending_claim_name = NULL, pending_claim_expires_at = NULL, pending_claim_status = NULL, pending_host_token = NULL WHERE code = ?`).bind(code).run();
      return json({ ok: true, status, hostToken });
    }
    if (status === "denied") {
      await env.DB.prepare(`UPDATE rooms SET pending_claim_id = NULL, pending_claim_name = NULL, pending_claim_expires_at = NULL, pending_claim_status = NULL, pending_host_token = NULL WHERE code = ?`).bind(code).run();
    }
    return json({ ok: true, status });
  }

  if (action === "approve" || action === "deny") {
    if (!(await tokenMatches(body.viewerToken, room.viewer_hash))) return error("invalid viewer token", 403);
    const claimId = typeof body.claimId === "string" ? body.claimId : "";
    if (!claimId || claimId !== room.pending_claim_id || room.pending_claim_status !== "pending") return error("claim not found", 404);
    if (Number(room.pending_claim_expires_at || 0) <= now) return error("claim expired", 410);
    if (action === "deny") {
      await env.DB.prepare("UPDATE rooms SET pending_claim_status = 'denied' WHERE code = ?").bind(code).run();
      return json({ ok: true, status: "denied" });
    }
    const pendingHostToken = room.pending_host_token;
    if (!pendingHostToken) return error("claim token missing", 409);
    await env.DB.prepare("UPDATE rooms SET pending_claim_status = 'approved', host_hash = ?, paired = 1, pair_hash = NULL, host_last_seen = ? WHERE code = ?")
      .bind(await hashToken(pendingHostToken), now, code).run();
    return json({ ok: true, status: "approved" });
  }

  if (action === "view") {
    if (!(await tokenMatches(body.viewerToken, room.viewer_hash))) return error("invalid viewer token", 403);
    let state = DEFAULT_STATE;
    try { state = JSON.parse(room.state_json || "null") || DEFAULT_STATE; } catch {}
    const pendingClaim = room.pending_claim_id && room.pending_claim_status === "pending"
      ? { id: room.pending_claim_id, clientName: room.pending_claim_name || "Haupthandy" }
      : null;
    return json({
      ok: true,
      paired: Boolean(room.paired),
      version: Number(room.version || 0),
      state,
      pendingClaim,
      hostOnline: Boolean(room.paired) && now - Number(room.host_last_seen || 0) < HOST_ONLINE_MS,
      expiresAt: Number(room.expires_at)
    });
  }

  if (action === "heartbeat") {
    if (!(await tokenMatches(body.hostToken, room.host_hash))) return error("invalid host token", 403);
    await env.DB.prepare("UPDATE rooms SET host_last_seen = ? WHERE code = ?").bind(now, code).run();
    return json({ ok: true });
  }

  if (action === "state") {
    if (!(await tokenMatches(body.hostToken, room.host_hash))) return error("invalid host token", 403);
    const incomingVersion = cleanInteger(body.version, 1, 2147483647);
    if (incomingVersion === undefined) return error("invalid version", 400);
    const currentVersion = Number(room.version || 0);
    if (incomingVersion <= currentVersion) {
      await env.DB.prepare("UPDATE rooms SET host_last_seen = ? WHERE code = ?").bind(now, code).run();
      return json({ ok: true, version: currentVersion, ignored: true });
    }
    let state;
    try { state = sanitizeTvState(body.state); } catch (caught) { return error(caught instanceof Error ? caught.message : "invalid state", 400); }
    await env.DB.prepare("UPDATE rooms SET version = ?, state_json = ?, host_last_seen = ? WHERE code = ?")
      .bind(incomingVersion, JSON.stringify(state), now, code).run();
    return json({ ok: true, version: incomingVersion });
  }

  return error("not found", 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        if (!env.DB) return error("D1 binding DB is missing", 500);
        return await handleApi(request, env, url);
      }
      if (request.method !== "GET") return error("method not allowed", 405);
      return assetResponse(url.pathname) || new Response("Nicht gefunden", { status: 404, headers: securityHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })) });
    } catch (caught) {
      return error(caught instanceof Error ? caught.message : "internal error", 500);
    }
  }
};
