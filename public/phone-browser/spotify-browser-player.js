(function(global){
  "use strict";
  const ORIGIN=global.location.origin,SDK_URL="https://sdk.scdn.co/spotify-player.js",PLAYER_NAME="Hitster Handy";
  const state={player:null,tokenRequestId:"",tokenCallbacks:[],tokenTimer:null,connected:false,deviceId:"",returnStarted:false,appPort:null,pendingMessages:[]};
  const status=document.getElementById("status");
  function setStatus(text,kind=""){if(!status)return;status.textContent=text;status.className=`status ${kind}`.trim();}
  function randomId(){try{const b=new Uint8Array(12);crypto.getRandomValues(b);return Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");}catch(_){return `${Date.now()}-${Math.random().toString(36).slice(2)}`;}}
  function send(type,payload={}){const message=JSON.stringify({source:"hitster-phone-browser",type,payload});if(state.appPort){try{state.appPort.postMessage(message);return;}catch(_){state.appPort=null;}}state.pendingMessages.push(message);if(state.pendingMessages.length>20)state.pendingMessages.shift();}
  function attachAppPort(port){if(!port)return;state.appPort=port;state.appPort.onmessage=event=>receive(event.data);try{state.appPort.start?.();}catch(_){}for(const message of state.pendingMessages.splice(0)){try{state.appPort.postMessage(message);}catch(_){state.pendingMessages.unshift(message);state.appPort=null;break;}}}
  function flushToken(token){for(const cb of state.tokenCallbacks.splice(0))try{cb(String(token||""));}catch(_){}}
  function requestToken(callback){state.tokenCallbacks.push(callback);if(state.tokenRequestId)return;state.tokenRequestId=`twa-${randomId()}`;send("TOKEN_REQUEST",{requestId:state.tokenRequestId});clearTimeout(state.tokenTimer);state.tokenTimer=setTimeout(()=>{state.tokenRequestId="";flushToken("");fail("token_timeout","Spotify-Zugriffstoken wurde nicht geliefert.");},15000);}
  function receive(message){let data=message;try{if(typeof data==="string")data=JSON.parse(data);}catch(_){return;}if(!data||data.source!=="hitster-android")return;if(data.type==="TOKEN_RESPONSE"){const p=data.payload||{};if(String(p.requestId||"")!==state.tokenRequestId)return;clearTimeout(state.tokenTimer);state.tokenTimer=null;state.tokenRequestId="";if(!p.ok||!p.accessToken){flushToken("");fail("token_error",p.error||"Spotify-Zugriffstoken fehlt.");return;}flushToken(String(p.accessToken));}else if(data.type==="APP_HELLO"){send("PAGE_READY",environment());}}
  global.addEventListener("message",event=>{if(event.origin&&event.origin!==ORIGIN)return;const port=event.ports&&event.ports[0];if(port)attachAppPort(port);receive(event.data);});
  function environment(){return{origin:ORIGIN,secureContext:global.isSecureContext===true,encryptedMediaApi:typeof navigator.requestMediaKeySystemAccess==="function",userAgent:String(navigator.userAgent||"").slice(0,220)};}
  function fail(code,message){setStatus(`Spotify-Fehler (${code}): ${message}`,"error");send("PLAYER_ERROR",{code:String(code),message:String(message||"").slice(0,240),environment:environment()});}
  function returnToHitster(){if(state.returnStarted||!state.deviceId)return;state.returnStarted=true;setStatus("Hitster Handy ist bereit. Rückkehr zur App …","ready");setTimeout(()=>{const link=document.createElement("a");link.href=`hitster://spotify-player-return?status=ready&deviceId=${encodeURIComponent(state.deviceId)}`;link.style.display="none";document.body.appendChild(link);link.click();setTimeout(()=>link.remove(),1000);},650);}
  function createPlayer(){if(state.player)return state.player;state.player=new Spotify.Player({name:PLAYER_NAME,volume:.8,enableMediaSession:true,getOAuthToken:requestToken});
    state.player.addListener("ready",({device_id})=>{state.deviceId=String(device_id||"");state.connected=!!state.deviceId;send("PLAYER_READY",{deviceId:state.deviceId,deviceName:PLAYER_NAME,environment:environment()});returnToHitster();});
    state.player.addListener("not_ready",({device_id})=>{state.connected=false;send("PLAYER_NOT_READY",{deviceId:String(device_id||"")});setStatus("Spotify-Gerät wurde vorübergehend getrennt.","error");});
    state.player.addListener("player_state_changed",playback=>{if(playback)send("PLAYER_STATE",{paused:!!playback.paused});});
    state.player.addListener("autoplay_failed",()=>{try{state.player.activateElement();}catch(_){}send("ACTIVATION_NEEDED",{});});
    for(const event of ["initialization_error","authentication_error","account_error","playback_error"])state.player.addListener(event,({message})=>fail(event,message||event));
    return state.player;
  }
  function load(){setStatus("Spotify Web Playback wird im Browsermotor geladen …");return new Promise((resolve,reject)=>{const finish=()=>global.Spotify?.Player?resolve(createPlayer()):reject(new Error("Spotify.Player fehlt."));if(global.Spotify?.Player)return finish();const prior=global.onSpotifyWebPlaybackSDKReady;global.onSpotifyWebPlaybackSDKReady=()=>{try{prior?.();}catch(_){}finish();};const script=document.createElement("script");script.src=SDK_URL;script.async=true;script.onerror=()=>reject(new Error("Spotify SDK konnte nicht geladen werden."));document.head.appendChild(script);setTimeout(()=>{if(!global.Spotify?.Player)reject(new Error("Spotify SDK antwortet nicht."));},20000);});}
  async function start(){send("PAGE_READY",environment());try{const player=await load();setStatus("Spotify verbindet …");const accepted=await player.connect();if(!accepted)throw new Error("player.connect() wurde abgelehnt.");setTimeout(()=>{if(!state.connected)fail("ready_timeout","Spotify hat Hitster Handy nicht als Gerät bestätigt.");},25000);}catch(error){fail("connect_error",error?.message||String(error));}}
  document.addEventListener("pointerdown",()=>{try{state.player?.activateElement?.();}catch(_){}},{once:true,capture:true});
  start();
})(window);
