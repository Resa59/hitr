"use strict";
const $=id=>document.getElementById(id),P=window.HitsterRealtimeProtocol;
const TV_SESSION_STORE="hitster_realtime_tv_session_v2";
const T={descriptor:null,transport:null,participantId:"",resumeToken:"",lastSequence:0,userClosed:false,retry:0,timer:null,currentState:{},pages:[],pageIndex:0,pageTimer:null,audio:null};
T.audio=window.HitsterTvSpotifyAudioController?new HitsterTvSpotifyAudioController({protocol:P,getDescriptor:()=>T.descriptor,getTransport:()=>T.transport,getParticipantId:()=>T.participantId,button:$("tvAudioButton")}):null;
window.HitsterRealtimeCanSwitchLocal=()=>T.audio?.canSwitchLocal?.()!==false;

function updateViewport(){const h=window.visualViewport?.height||window.innerHeight;document.documentElement.style.setProperty("--app-height",`${Math.max(320,Math.round(h))}px`);if(T.currentState?.phase)configurePages(T.currentState,true)}
updateViewport();window.addEventListener("resize",()=>{updateViewport()},{passive:true});window.visualViewport?.addEventListener("resize",()=>{updateViewport()},{passive:true});

try{if(location.hash.length>2)T.descriptor=P.parseJoinLink(location.href)}catch(e){$("joinMessage").textContent=e.message}
try{const h=new URLSearchParams(location.hash.replace(/^#/,""));T.participantId=h.get("pid")||"";T.resumeToken=h.get("resume")||"";T.lastSequence=Number(h.get("seq")||0)}catch(_){}
try{const saved=JSON.parse(localStorage.getItem(TV_SESSION_STORE)||"null");if(saved&&T.descriptor&&saved.sessionId===T.descriptor.sessionId){T.participantId=saved.participantId||T.participantId;T.resumeToken=saved.resumeToken||T.resumeToken;T.lastSequence=Number(saved.lastSequence||T.lastSequence||0)}}catch(_){}
if(T.descriptor)$("code").value=T.descriptor.roomCode||"";

$("joinButton").onclick=join;$("nextSession").onclick=resetToPairing;$("previousPage").onclick=()=>setPage(T.pageIndex-1,true);$("nextPage").onclick=()=>setPage(T.pageIndex+1,true);$("fullscreenButton").onclick=toggleFullscreen;document.addEventListener("fullscreenchange",updateFullscreenButton);updateFullscreenButton();

async function resolveCode(code){const u=new URL("/api/realtime/resolve",location.origin);u.searchParams.set("code",code);u.searchParams.set("role","tv");const r=await fetch(u,{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error||"Raum nicht gefunden.");return P.validateDescriptor(j)}
async function join(){const code=$("code").value.trim().toUpperCase();if(!code)return $("joinMessage").textContent="Raumcode fehlt.";$("joinButton").disabled=true;$("joinMessage").textContent="Verbindung wird hergestellt …";try{if(!T.descriptor||T.descriptor.roomCode!==code)T.descriptor=await resolveCode(code);await connect()}catch(e){$("joinMessage").textContent=e.message}finally{$("joinButton").disabled=false}}
async function connect(){T.userClosed=false;setStatus(false,"Cloud-Verbindung wird hergestellt …");const t=new CloudFirstRealtimeTransport(T.descriptor,{role:"tv",localPath:"/tv/",connectTimeoutMs:9000});T.transport=t;
  t.onMessage=(raw,transport)=>message(raw,transport);
  t.onClose=()=>{if(!T.userClosed)reconnect()};
  t.onError=error=>{const message=error?.message||"Verbindung gestört";setStatus(false,message);$("joinMessage").textContent=message;};
  t.onTransport=(name,phase)=>{const label=name==="local"?"Lokales WLAN":"Cloud",texts={bootstrap:"Lokales WLAN wird geprüft …",probing:"Lokales WLAN wird geprüft …",selecting:"Cloud wird als Rückfallverbindung aktiviert …",switching:"Wechsel ins lokale WLAN …","secure-audio":"Sichere Cloud-Verbindung für TV-Ton"};setStatus(phase==="welcome",texts[phase]||`${label}${phase==="welcome"?" verbunden":" wird verbunden …"}`)};
  t.onCloudSelected=()=>sendTransportSelection("cloud");
  t.onBeforeLocalSwitch=()=>sendTransportSelection("local");
  t.onOpen=()=>t.send(JSON.stringify(P.envelope(P.TYPES.HELLO,T.descriptor.sessionId,{role:"tv",inviteToken:T.descriptor.inviteToken,clientId:stableClientId(),displayName:"Hitster TV",participantId:T.participantId||null,resumeToken:T.resumeToken||null,lastSequence:T.lastSequence,connectionAttemptId:P.randomId(12)})));
  await t.connect()
}
function sendTransportSelection(transport){if(!T.transport)return;T.transport.send(JSON.stringify(P.envelope(P.TYPES.TRANSPORT_SELECTED,T.descriptor.sessionId,{transport,resumed:!!T.resumeToken,participantId:T.participantId||null})))}
function stableClientId(){try{let id=localStorage.getItem("hitster_tv_client_id");if(!id){id=P.randomId(18);localStorage.setItem("hitster_tv_client_id",id)}return id}catch(_){return P.randomId(18)}}
function persistTvSession(){try{if(!T.descriptor||!T.participantId)return;localStorage.setItem(TV_SESSION_STORE,JSON.stringify({sessionId:T.descriptor.sessionId,participantId:T.participantId,resumeToken:T.resumeToken,lastSequence:T.lastSequence}))}catch(_){}}
function clearTvSession(){try{localStorage.removeItem(TV_SESSION_STORE)}catch(_){}T.participantId="";T.resumeToken="";T.lastSequence=0}
function message(raw,transport){let m;try{m=P.assertEnvelope(JSON.parse(raw),T.descriptor.sessionId)}catch(e){return setStatus(false,e.message)}
  if(T.audio?.handleMessage?.(m))return;
  if(m.type===P.TYPES.WELCOME){if((transport||m.payload.transport)==="cloud"&&(!Array.isArray(m.payload?.capabilities)||!m.payload.capabilities.includes("transport-selection-v1"))){const text="Der veröffentlichte Cloudflare-Worker ist veraltet. Bitte das aktuelle Cloudflare-Paket deployen.";setStatus(false,text);$("joinMessage").textContent=text;T.userClosed=true;T.transport?.close(4009,"incompatible-worker");return;}T.retry=0;T.participantId=m.payload.participantId;T.resumeToken=m.payload.resumeToken;if(Number(m.sequence||0)>0)T.lastSequence=Number(m.sequence);persistTvSession();T.transport?.confirmWelcome?.(transport||m.payload.transport,m.payload);if((transport||m.payload.transport)==="local"){$("join").classList.add("hidden");$("stage").classList.remove("hidden");setStatus(true,"Verbunden · Lokales WLAN");T.audio?.onWelcome?.("local");render(m.payload.snapshot||{phase:"lobby"})}return}
  if(m.type===P.TYPES.TRANSPORT_CONFIRMED){if(m.payload?.transport!=="cloud")return;T.transport?.confirmTransport?.("cloud");$("join").classList.add("hidden");$("stage").classList.remove("hidden");setStatus(true,"Verbunden · Cloud");T.audio?.onWelcome?.("cloud");render(T.currentState&&Object.keys(T.currentState).length?T.currentState:{phase:"lobby"});return}
  if(m.type===P.TYPES.TV_STATE||m.type===P.TYPES.TV_SNAPSHOT){const seq=Number(m.sequence||0);if(seq&&seq<=T.lastSequence)return;T.lastSequence=seq||T.lastSequence;persistTvSession();setStatus(true,"Mit dem Haupthandy verbunden");render(m.payload||{});return}
  if(m.type===P.TYPES.REMOVED){setStatus(false,m.payload?.reason||"Der Fernseher wurde vom Haupthandy getrennt");clearTvSession();T.userClosed=true;T.transport?.close();$("nextSession").classList.remove("hidden");return}
  if(m.type===P.TYPES.SESSION_ENDED){if(m.payload?.finalSnapshot)render(m.payload.finalSnapshot);setStatus(false,"Der Raum wurde geschlossen");clearTvSession();T.userClosed=true;T.transport?.close();$("nextSession").classList.remove("hidden");return}
  if(m.type===P.TYPES.ERROR)setStatus(false,m.payload?.message||"Verbindungsfehler")
}
function reconnect(){setStatus(false,"Verbindung unterbrochen – Wiederverbindung läuft");clearTimeout(T.timer);const wait=Math.min(20000,800*Math.pow(1.7,Math.min(T.retry++,9)));T.timer=setTimeout(async()=>{try{await connect()}catch(_){reconnect()}},wait)}
function setStatus(on,text){$("dot").classList.toggle("on",on);$("connection").textContent=text}

function phaseLabel(phase){return({connecting:"VERBINDUNG",lobby:"SPIELLOBBY",round_intro:"NÄCHSTE RUNDE",playing:"LIED LÄUFT",input_wait:"ANTWORT",review_wait:"AUSWERTUNG",reveal:"AUFLÖSUNG",round_results:"RUNDENERGEBNIS",scoreboard:"ZWISCHENSTAND",statistics:"STATISTIKEN",summary:"SPIELENDE",ended:"SPIELENDE",aborted:"ABGEBROCHEN",disconnected:"VERBINDUNG"})[phase]||"HITSTER"}
function defaultHeadline(p){return({connecting:"Hitster TV",lobby:"Spiel wird vorbereitet",round_intro:"Nächster Spieler",playing:"Unbekannter Titel läuft",input_wait:"Jetzt antworten",review_wait:"Wertungen werden geprüft",reveal:"Auflösung",round_results:"Rundenauswertung",scoreboard:"Zwischenstand",statistics:"Spielstatistiken",summary:"Spiel beendet",ended:"Spiel beendet",aborted:"Spiel abgebrochen",disconnected:"Verbindung verloren"})[p]||"Hitster"}
function defaultSubline(p){return({connecting:"Warte auf das Haupthandy",lobby:"Warte auf den Spielstart",playing:"Hört gut zu",input_wait:"Die Eingabe bleibt auf dem Handy privat",review_wait:"Warte auf alle Spieler",reveal:"Die richtige Lösung",round_results:"Punkte dieser Runde",scoreboard:"Aktueller Punktestand",statistics:"Vergleich aller Spieler",summary:"Gesamtauswertung",ended:"Gesamtauswertung",aborted:"Die laufende Runde wurde verworfen",disconnected:"Wiederverbindung läuft"})[p]||""}

function render(s){T.currentState=s||{};const phase=s.phase||"connecting",stage=$("stage");stage.dataset.phase=phase;
  $("round").textContent=[phaseLabel(phase),s.round?`RUNDE ${s.round}`:""].filter(Boolean).join(" · ");
  $("headline").textContent=s.headline||defaultHeadline(phase);$("subline").textContent=s.subline||defaultSubline(phase);
  $("currentPlayer").textContent=s.currentPlayer||"";$("playerBadge").classList.toggle("hidden",!s.currentPlayer);
  const privatePhase=["playing","input_wait","review_wait"].includes(phase);$("privacyNote").classList.toggle("hidden",!privatePhase);
  $("disc").classList.toggle("playing",phase==="playing");configurePages(s,false)
}

function pageCapacity(kind){const h=window.visualViewport?.height||window.innerHeight,w=window.visualViewport?.width||window.innerWidth,narrow=w<1050;
  // Die Kapazität richtet sich bewusst nach der sichtbaren Höhe. Die Kopfzeile,
  // Phasenüberschrift und Seitennavigation brauchen auf einem TV einen festen
  // Anteil; zu viele Zeilen würden sonst am unteren Browserrand abgeschnitten.
  if(kind==="ranking"){if(h<630)return 3;if(h<820)return 4;if(h<980)return narrow?4:5;return narrow?5:6}
  if(kind==="results"){if(h<630)return 4;if(h<820)return narrow?4:6;if(h<980)return 8;return 10}
  if(kind==="cards"){if(h<630)return 2;if(h<980)return 4;return narrow?4:6}
  return 1
}
function chunks(items,size){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out.length?out:[[]]}
function buildPages(s){const phase=s.phase||"connecting",pages=[];
  if(phase==="round_results"&&Array.isArray(s.roundResults)&&s.roundResults.length){for(const group of chunks(s.roundResults,pageCapacity("results")))pages.push({kind:"round-results",rows:group,showHero:!!s.song})}
  else if(phase==="scoreboard"){for(const group of chunks(s.scoreboard||[],pageCapacity("ranking")))pages.push({kind:"ranking",rows:group})}
  else if(["statistics","summary","ended"].includes(phase)){
    const score=Array.isArray(s.scoreboard)?s.scoreboard:[];for(const group of chunks(score,pageCapacity("ranking"))){if(group.length)pages.push({kind:"ranking",rows:group,summary:true})}
    const highlights=statisticsHighlights(s.statistics,score);for(const group of chunks(highlights,pageCapacity("cards"))){if(group.length)pages.push({kind:"stat-highlights",rows:group})}
    const cards=statisticsCards(s.statistics);for(const group of chunks(cards,pageCapacity("cards"))){if(group.length)pages.push({kind:"stat-categories",rows:group})}
    if(!pages.length)pages.push({kind:"main"})
  }else pages.push({kind:"main"});
  return pages
}
function configurePages(s,preserveIndex){const prior=preserveIndex?T.pageIndex:0;T.pages=buildPages(s);T.pageIndex=Math.min(prior,Math.max(0,T.pages.length-1));setPage(T.pageIndex,false)}
function setPage(index,manual){if(!T.pages.length)return;T.pageIndex=(index+T.pages.length)%T.pages.length;renderPage(T.pages[T.pageIndex]);const multi=T.pages.length>1;$("pager").classList.toggle("hidden",!multi);$("pageInfo").textContent=`${T.pageIndex+1} / ${T.pages.length}`;clearTimeout(T.pageTimer);if(multi)T.pageTimer=setTimeout(()=>setPage(T.pageIndex+1,false),manual?12000:9000)}
function clearView(){$("hero").classList.add("hidden");$("progress").classList.add("hidden");$("roundResults").classList.add("hidden");$("scoreSection").classList.add("hidden");$("statisticsSection").classList.add("hidden");$("roundResults").innerHTML="";$("ranking").innerHTML="";$("statHighlights").innerHTML="";$("categoryStats").innerHTML=""}
function renderPage(page){clearView();const s=T.currentState||{},phase=s.phase||"connecting";$("headline").textContent=s.headline||defaultHeadline(phase);$("subline").textContent=s.subline||defaultSubline(phase);if(page.kind==="main"){renderMain(s);return}
  if(page.kind==="round-results"){renderHero(s,true);$("roundResults").classList.remove("hidden");$("roundResults").innerHTML=roundResultHtml(page.rows);return}
  if(page.kind==="ranking"){$("scoreSection").classList.remove("hidden");$("ranking").innerHTML=rankingHtml(page.rows);if(page.summary)$("subline").textContent="Endrangliste und Spielvergleich";return}
  if(page.kind==="stat-highlights"){$("statisticsSection").classList.remove("hidden");$("statisticsTitle").textContent="Höhepunkte";$("statHighlights").innerHTML=page.rows.map(([v,l])=>`<div class="stat-card"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");return}
  if(page.kind==="stat-categories"){$("statisticsSection").classList.remove("hidden");$("statisticsTitle").textContent="Kategorienvergleich";$("categoryStats").innerHTML=page.rows.join("")}
}
function renderMain(s){renderHero(s,false);renderMetrics(s)}
function renderHero(s,withResults){const phase=s.phase||"connecting",song=s.song;$("hero").classList.toggle("hidden",["scoreboard","statistics","summary","ended"].includes(phase)&&!song);if(!$("hero").classList.contains("hidden"))$("hero").classList.remove("hidden");$("song").classList.toggle("hidden",!song);if(song){$("songTitle").textContent=song.title||"";$("songArtist").textContent=song.artist||"";$("songYear").textContent=[song.decade,song.year||""].filter(Boolean).join(" · ")}if(withResults&&song)$("hero").classList.remove("hidden")}
function renderMetrics(s){const p=s.progress||null,metrics=[];if(p){metrics.push([`${Number(p.submitted||0)} / ${Number(p.total||0)}`,"Antworten"]);if(Number(p.confirmed||0)||s.phase==="review_wait"||s.phase==="reveal")metrics.push([`${Number(p.confirmed||0)} / ${Number(p.total||0)}`,"Wertungen"])}if(s.song?.year)metrics.push([String(s.song.year),"Erscheinungsjahr"]);$("progress").innerHTML=metrics.map(([a,b])=>`<div class="metric"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");$("progress").classList.toggle("hidden",metrics.length===0)}
function roundResultHtml(rows){return(rows||[]).map(r=>`<div class="result-card"><div><b>${esc(r.name||"Spieler")}</b><small>${Number(r.points||0)>=Number(r.maxPoints??r.max??0)&&Number(r.maxPoints??r.max??0)>0?"komplett richtig":"Teilwertung"}</small></div><span class="score">${num(r.points)} / ${num(r.maxPoints??r.max)}</span></div>`).join("")}
function rankingHtml(rows){return(rows||[]).map((r,i)=>{const place=Number.isInteger(r.place)?r.place:i+1,max=Number(r.maxPoints??r.max??0),points=Number(r.points||0),pct=max>0?Math.max(0,Math.min(100,points/max*100)):Number(r.percentage||0);return `<div class="rank-row ${place===1?"first":""}"><span class="place">${esc(place)}.</span><div><span class="rank-name">${esc(r.name||"Spieler")}</span><span class="rank-meta">${num(r.perfect)} komplett richtig · ${num(r.imperfect)} mit Teilfehlern</span><div class="bar"><span style="width:${pct}%"></span></div></div><span class="rank-score">${num(points)} / ${num(max)}</span></div>`}).join("")}
function statisticsHighlights(stats,scoreboard){const rows=Array.isArray(scoreboard)?scoreboard:[],high=[];if(rows.length){const byPoints=[...rows].sort((a,b)=>Number(b.points||0)-Number(a.points||0))[0],byRate=[...rows].sort((a,b)=>rate(b)-rate(a))[0],byPerfect=[...rows].sort((a,b)=>Number(b.perfect||0)-Number(a.perfect||0))[0];high.push([byPoints?.name||"–",`Meiste Punkte (${num(byPoints?.points)})`],[byRate?.name||"–",`Beste Trefferquote (${rate(byRate).toFixed(1)} %)`],[byPerfect?.name||"–",`Meiste perfekte Runden (${num(byPerfect?.perfect)})`])}const rounds=stats?.rounds??stats?.roundCount;if(rounds!=null)high.push([num(rounds),"Gespielte Runden"]);return high}
function statisticsCards(stats){if(!stats||typeof stats!=="object")return[];const cards=[],categories=stats.categories||stats.categoryResults;if(categories&&typeof categories==="object"&&!Array.isArray(categories)){for(const[key,value]of Object.entries(categories)){if(value&&typeof value==="object"){const entries=Object.entries(value);for(let i=0;i<entries.length;i+=4){const group=entries.slice(i,i+4),suffix=entries.length>4?` · ${Math.floor(i/4)+1}/${Math.ceil(entries.length/4)}`:"",lines=group.map(([name,v])=>`<div class="category-line"><span>${esc(name)}</span><b>${formatValue(v)}</b></div>`).join("");cards.push(`<div class="category-card"><h4>${esc(categoryName(key))}${suffix}</h4>${lines}</div>`)}}}}const players=Array.isArray(stats.players)?stats.players:[];for(const p of players){const lines=[];for(const key of["title","artist","decade","year"]){const v=p[key]??p.categories?.[key];if(v!=null)lines.push(`<div class="category-line"><span>${categoryName(key)}</span><b>${formatValue(v)}</b></div>`)}if(lines.length)cards.push(`<div class="category-card"><h4>${esc(p.name||"Spieler")}</h4>${lines.join("")}</div>`)}return cards}
function categoryName(k){return({title:"Titel",artist:"Künstler",decade:"Jahrzehnt",year:"Jahr",accuracy:"Trefferquote",points:"Punkte",perfect:"Perfekte Runden"})[k]||String(k).replace(/_/g," ")}
function formatValue(v){if(v&&typeof v==="object"){if(v.correct!=null&&v.total!=null)return`${num(v.correct)} / ${num(v.total)}`;if(v.percentage!=null)return`${num(v.percentage)} %`;return Object.values(v).slice(0,2).map(formatValue).join(" / ")}return typeof v==="number"?num(v):esc(v)}
function rate(r){const m=Number(r?.maxPoints??r?.max??0);return m>0?Number(r?.points||0)*100/m:Number(r?.percentage||0)}function num(v){const n=Number(v||0);return Number.isInteger(n)?String(n):n.toFixed(1)}
async function resetToPairing(){T.userClosed=true;clearTimeout(T.timer);clearTimeout(T.pageTimer);clearTvSession();try{await T.transport?.close()}catch(_){}location.replace("/")}
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(_){setStatus(false,"Vollbild wird nicht unterstützt")}}
function updateFullscreenButton(){const b=$("fullscreenButton");if(!document.fullscreenEnabled){b.classList.add("hidden");return}b.textContent=document.fullscreenElement?"Vollbild beenden":"Vollbild";updateViewport()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c])}
window.HitsterRealtimeHandoff=()=>({participantId:T.participantId,resumeToken:T.resumeToken,lastSequence:T.lastSequence,displayName:"Hitster TV"});
if("serviceWorker" in navigator)navigator.serviceWorker.register("/tv/sw.js").catch(()=>{});if(T.descriptor)join();
