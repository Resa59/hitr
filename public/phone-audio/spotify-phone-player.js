(function(){
  "use strict";
  const CHANNEL="hitster-phone-audio-v1";
  const SDK_URL="https://sdk.scdn.co/spotify-player.js";
  const PLAYER_NAME="Hitster Handy";
  const state={player:null,deviceId:"",connected:false,token:"",tokenExpiresAt:0,pendingToken:null,connectStarted:false,startRequested:false,sdkReady:false,readyTimer:null};
  const send=(type,payload={})=>parent.postMessage({channel:CHANNEL,type,payload},"*");
  const randomId=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
  function requestToken(callback){
    if(state.token&&state.tokenExpiresAt>Date.now()+45000){callback(state.token);return;}
    const requestId=randomId();
    state.pendingToken={requestId,callback,timer:setTimeout(()=>{
      state.pendingToken=null;callback("");send("error",{code:"token-timeout",message:"Spotify-Anmeldung hat zu lange gedauert."});
    },15000)};
    send("token-request",{requestId});
  }
  function handleToken(payload){
    const pending=state.pendingToken;
    if(!pending||payload.requestId!==pending.requestId)return;
    clearTimeout(pending.timer);state.pendingToken=null;
    if(!payload.ok||!payload.accessToken){pending.callback("");send("error",{code:"token",message:payload.error||"Spotify-Zugriffstoken fehlt."});return;}
    state.token=String(payload.accessToken);state.tokenExpiresAt=Number(payload.expiresAt||Date.now()+45*60*1000);
    pending.callback(state.token);
  }
  function createPlayer(){
    if(state.player)return state.player;
    state.player=new Spotify.Player({name:PLAYER_NAME,volume:.8,enableMediaSession:true,getOAuthToken:requestToken});
    state.player.addListener("ready",({device_id})=>{
      clearTimeout(state.readyTimer);state.readyTimer=null;state.deviceId=String(device_id||"");state.connected=!!state.deviceId;
      send("ready",{deviceId:state.deviceId,deviceName:PLAYER_NAME,volume:80});
    });
    state.player.addListener("not_ready",({device_id})=>{
      if(!device_id||String(device_id)===state.deviceId)state.deviceId="";state.connected=false;
      send("not-ready",{deviceId:String(device_id||"")});
    });
    state.player.addListener("player_state_changed",s=>{if(s)send("playback",{paused:!!s.paused,deviceId:state.deviceId});});
    state.player.addListener("autoplay_failed",()=>send("autoplay-failed",{deviceId:state.deviceId}));
    for(const eventName of ["initialization_error","authentication_error","account_error","playback_error"]){
      state.player.addListener(eventName,({message})=>{
        if(eventName!=="playback_error"){
          state.connectStarted=false;state.connected=false;state.deviceId="";
          try{state.player?.disconnect?.();}catch(_){}
          state.player=null;
        }
        send("error",{code:eventName,message:message||eventName});
      });
    }
    return state.player;
  }
  async function connect(){
    if(state.connectStarted||state.connected)return;
    state.connectStarted=true;
    try{
      const player=createPlayer();
      const accepted=await player.connect();
      if(!accepted)throw new Error("Spotify Web Playback konnte nicht verbunden werden.");
      clearTimeout(state.readyTimer);
      state.readyTimer=setTimeout(()=>{if(!state.connected)send("error",{code:"ready-timeout",message:"Spotify hat den Handy-Player nicht als Gerät bestätigt."});},18000);
    }catch(error){state.connectStarted=false;send("error",{code:"connect",message:error?.message||String(error)});}
  }
  function loadSdk(){
    const ready=()=>{state.sdkReady=true;send("sdk-ready",{});if(state.startRequested)connect();};
    if(window.Spotify?.Player){ready();return;}
    window.onSpotifyWebPlaybackSDKReady=ready;
    const script=document.createElement("script");script.src=SDK_URL;script.async=true;
    script.onerror=()=>send("error",{code:"sdk",message:"Spotify Web Playback konnte nicht geladen werden."});
    document.head.appendChild(script);
    setTimeout(()=>{if(!window.Spotify?.Player)send("error",{code:"sdk-timeout",message:"Spotify Web Playback antwortet nicht."});},20000);
  }
  addEventListener("message",event=>{
    if(event.source!==parent)return;
    const message=event.data||{};if(message.channel!==CHANNEL)return;
    if(message.type==="token-result")handleToken(message.payload||{});
    if(message.type==="activate"){
      state.startRequested=true;
      try{state.player?.activateElement?.();}catch(_){}
      if(state.sdkReady)connect();else loadSdk();
    }
    if(message.type==="disconnect"){try{state.player?.disconnect?.();}catch(_){}state.player=null;state.deviceId="";state.connected=false;state.connectStarted=false;}
  });
  send("loaded",{secureContext:window.isSecureContext});
  loadSdk();
})();
