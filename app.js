import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,addDoc,deleteDoc,doc,onSnapshot,query,orderBy} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====== PASTE YOUR FIREBASE CONFIG HERE (Project settings > Your apps > Web app) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyAhADKJfmfjLinq_RS5GVLLCS8SSGjwdaA",
  authDomain: "usdt-tracker-e2f2e.firebaseapp.com",
  projectId: "usdt-tracker-e2f2e",
  storageBucket: "usdt-tracker-e2f2e.firebasestorage.app",
  messagingSenderId: "382559374800",
  appId: "1:382559374800:web:78e6ce4ee404b4362bbdd5"
};
/* ====================================================================================== */

const $=id=>document.getElementById(id);
const configured=!firebaseConfig.apiKey.startsWith("PASTE");
let auth,db,unsub=null,trades=[],isAdmin=false;
let unsubB=null,xfers=[],bready=false;
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2000)};
const n=id=>parseFloat($(id).value)||0;
const f=(v,d=2)=>(v<0?"−":"")+"৳"+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const pad=x=>String(x).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const tm=ts=>{const d=new Date(ts);let h=d.getHours();const ap=h>=12?"PM":"AM";return pad(h%12||12)+":"+pad(d.getMinutes())+" "+ap};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};

/* ---------- calculator (public) ---------- */
function calc(){const eff=n("buy")*(1+n("fee")/100),per=n("sell")-eff;return{eff,per,tot:per*n("qty")}}
function live(){const c=calc();$("per").textContent=f(c.per,4);$("per").className="big"+(c.per<0?" neg":"");$("tot").textContent=f(c.tot);$("eff").textContent=f(c.eff,4)}
const SAVED=["buy","sell","fee","qty"];
try{const s=JSON.parse(localStorage.getItem("calc")||"{}");SAVED.forEach(i=>{if(s[i]!==undefined)$(i).value=s[i]})}catch(e){}
SAVED.forEach(i=>$(i).addEventListener("input",()=>{live();try{localStorage.setItem("calc",JSON.stringify(Object.fromEntries(SAVED.map(k=>[k,$(k).value]))))}catch(e){}}));
live();
$("yr").textContent=new Date().getFullYear();

/* ---------- auth ---------- */
let ready=false;
const hint=()=>{try{return localStorage.getItem("wasAdmin")==="1"}catch(e){return false}};
const setHint=v=>{try{localStorage.setItem("wasAdmin",v?"1":"0")}catch(e){}};
isAdmin=configured&&hint();   /* optimistic state so the page does not flash on refresh */
const openDays=new Set();let seeded=false;
/* instant refresh: show last-known data from this device while Firebase reconnects */
const ld=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}};
const sv=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
if(isAdmin){const a1=ld("cTrades"),b1=ld("cXfers");if(a1){trades=a1;ready=true}if(b1){xfers=b1;bready=true}}
/* pages: Calculator / Bank (stays on the same page after refresh) */
const PAGES={calc:["USDT profit calculator","Calculate your net profit in BDT."],bank:["Bank daily limits","Daily transfer limit of each bank account."]};
let page=(location.hash||"").slice(1);if(!PAGES[page])page=ld("page");if(!PAGES[page])page="calc";
function showPage(p){
  if(p==="bank"&&!isAdmin)p="calc";
  page=p;sv("page",p);
  try{if(location.hash!=="#"+p)history.replaceState(null,"","#"+p)}catch(e){}
  $("pg-calc").classList.toggle("hide",p!=="calc");$("pg-bank").classList.toggle("hide",p!=="bank");
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  $("ttl").textContent=PAGES[p][0];$("sub").textContent=PAGES[p][1];
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showPage(b.dataset.p));
addEventListener("hashchange",()=>{const p=location.hash.slice(1);if(PAGES[p])showPage(p)});
ui();render();
if(configured){
  const app=initializeApp(firebaseConfig);auth=getAuth(app);
  db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
  onAuthStateChanged(auth,u=>{
    isAdmin=!!u;setHint(isAdmin);ui();
    if(unsub){unsub();unsub=null}
    if(!u)ready=false;
    if(u){
      render();
      unsub=onSnapshot(query(collection(db,"trades"),orderBy("t","desc")),
        s=>{trades=s.docs.map(d=>({id:d.id,...d.data()}));ready=true;sv("cTrades",trades);render()},
        ()=>{ready=true;toast("Access denied: this account is not the admin")});
    }else{trades=[];sv("cTrades",null);render()}
    /* bank transfers (separate collection: old trades are untouched) */
    if(unsubB){unsubB();unsubB=null}
    if(!u)bready=false;
    if(u){
      bankRender();
      unsubB=onSnapshot(query(collection(db,"bankTransfers"),orderBy("t","desc")),
        s=>{xfers=s.docs.map(d=>({id:d.id,...d.data()}));bready=true;sv("cXfers",xfers);bankRender()},
        ()=>{bready=true;bankRender();toast("Bank data: access denied. Update Firestore rules")});
    }else{xfers=[];sv("cXfers",null);bankRender()}
  });
}
function ui(){
  $("authBtn").textContent=isAdmin?"Log out":"Admin login";
  $("admin").classList.toggle("hide",!isAdmin);
  $("locked").classList.toggle("hide",isAdmin);
  $("add").classList.toggle("hide",!isAdmin);
  $("tabBank").classList.toggle("hide",!isAdmin);
  showPage(page);
}
$("authBtn").onclick=()=>{
  if(!configured){toast("Firebase is not set up yet");return}
  if(isAdmin){signOut(auth);return}
  $("err").textContent="";$("dlg").showModal();
};
$("cancel").onclick=()=>$("dlg").close();
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("err").textContent="";
  try{await signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value);$("pw").value="";$("dlg").close()}
  catch(x){$("err").textContent="Wrong email or password"}
});

/* ---------- save trade (admin) ---------- */
$("add").onclick=async()=>{
  if(!isAdmin)return;
  if(n("qty")<=0||n("buy")<=0||n("sell")<=0){toast("Enter buy, sale and quantity");return}
  try{
    addDoc(collection(db,"trades"),{t:Date.now(),buy:n("buy"),sell:n("sell"),fee:n("fee"),qty:n("qty"),profit:calc().tot}).catch(()=>toast("Could not save"));
    toast("Saved to history ✓");
  }catch(e){toast("Could not save")}
};

/* ---------- history (admin) ---------- */
function filtered(){const a=$("from").value,b=$("to").value;return trades.filter(x=>{const d=ymd(new Date(x.t));return(!a||d>=a)&&(!b||d<=b)})}
function render(){
  if(!isAdmin)return;
  const box=$("list");
  if(!ready){
    ["sp","sc","sq","sa"].forEach(i=>{$(i).textContent="—";$(i).className=""});
    $("barFill").style.width="0";box.textContent="";
    for(let i=0;i<3;i++)box.appendChild(el("div","skel"));
    return;
  }
  const L=filtered(),sum=L.reduce((s,x)=>s+x.profit,0),all=trades.reduce((s,x)=>s+x.profit,0);
  $("sp").textContent=f(sum);$("sp").className=sum<0?"neg":"pos";
  $("sc").textContent=L.length;$("sq").textContent=L.reduce((s,x)=>s+x.qty,0).toLocaleString("en-US");
  $("sa").textContent=f(all);
  $("barFill").style.width=(all>0?Math.min(100,Math.max(0,sum/all*100)):0)+"%";
  box.textContent="";
  if(!L.length){box.appendChild(el("div","card lock","No trades found for this period."));return}
  const g=new Map();L.forEach(x=>{const k=ymd(new Date(x.t));(g.get(k)||g.set(k,[]).get(k)).push(x)});
  if(!seeded){openDays.add(ymd(new Date(L[0].t)));seeded=true}
  g.forEach((arr,k)=>{
    const d=el("details");d.open=openDays.has(k);
    d.addEventListener("toggle",()=>{d.open?openDays.add(k):openDays.delete(k)});
    const s=el("summary");
    const dd=new Date(arr[0].t);
    s.append(el("span","d",pad(dd.getDate())+"/"+pad(dd.getMonth()+1)),
      el("span","n",dd.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})),
      el("span","c",arr.length+" trade"+(arr.length>1?"s":"")));
    const ps=arr.reduce((a,x)=>a+x.profit,0);
    s.appendChild(el("span","c "+(ps<0?"neg":"pos"),f(ps)));
    d.appendChild(s);
    const rows=el("div","rows");
    arr.forEach(x=>{
      const r=el("div","r"),l=el("div");
      l.append(el("span",null,x.qty.toLocaleString("en-US")+" USDT"),el("small",null,tm(x.t)+" · buy "+x.buy.toFixed(2)+" → sell "+x.sell.toFixed(2)+" · fee "+x.fee.toFixed(2)+"%"));
      const p=el("b",x.profit<0?"neg":"pos",f(x.profit));
      const b=el("button","x","✕");b.title="Delete";
      b.onclick=async()=>{if(confirm("Delete this trade?")){deleteDoc(doc(db,"trades",x.id)).catch(()=>toast("Could not delete"))}};
      r.append(l,p,b);rows.appendChild(r);
    });
    d.appendChild(rows);box.appendChild(d);
  });
}
["from","to"].forEach(i=>$(i).addEventListener("change",render));
document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{
  const r=b.dataset.r,now=new Date();
  if(r==="all"){$("from").value="";$("to").value=""}
  if(r==="today")$("from").value=$("to").value=ymd(now);
  if(r==="week"){const s=new Date(now);s.setDate(s.getDate()-6);$("from").value=ymd(s);$("to").value=ymd(now)}
  if(r==="month"){$("from").value=ymd(new Date(now.getFullYear(),now.getMonth(),1));$("to").value=ymd(now)}
  render();
});

/* ---------- Excel export ---------- */
/* Excel library is loaded only when you press Export (keeps the page fast) */
let xlP=null;
const loadXLSX=()=>window.XLSX?Promise.resolve():(xlP||(xlP=new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=ok;s.onerror=()=>{xlP=null;no()};document.head.appendChild(s)})));

$("xl").onclick=async()=>{
  const L=filtered();if(!L.length){toast("Nothing to export");return}
  try{await loadXLSX()}catch(e){toast("Could not load Excel tool");return}
  const rows=L.map(x=>({"Date":ymd(new Date(x.t)),"Time":tm(x.t),"Buy price":x.buy,"Sale price":x.sell,"Fee %":x.fee,"USDT qty":x.qty,"Net profit (BDT)":+x.profit.toFixed(2)}));
  rows.push({"Date":"TOTAL","Net profit (BDT)":+L.reduce((s,x)=>s+x.profit,0).toFixed(2)});
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
  ws["!cols"]=[{wch:12},{wch:10},{wch:11},{wch:11},{wch:8},{wch:10},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws,"Profit");
  XLSX.writeFile(wb,"usdt_profit_"+ymd(new Date())+".xlsx");
};

/* =====================================================================
   BANK DAILY LIMITS  (admin only, synced through Firestore "bankTransfers")
   Day boundary = 12:00 AM Bangladesh time (Asia/Dhaka), on every device.
   To change a limit or add a bank, edit the BANKS list below.
   ===================================================================== */
const BANKS=[
  {id:"ific1", name:"IFIC 1", limit:1000000},
  {id:"ific2", name:"IFIC 2", limit:1000000},
  {id:"pubali",name:"Pubali", limit:1000000},
  {id:"city",  name:"City",   limit:1000000}
];
const TZ="Asia/Dhaka";
const dk=ts=>new Date(ts).toLocaleDateString("en-CA",{timeZone:TZ});          /* YYYY-MM-DD in Dhaka */
const mk=ts=>dk(ts).slice(0,7);                                              /* YYYY-MM */
const tz=ts=>new Date(ts).toLocaleTimeString("en-US",{timeZone:TZ,hour:"2-digit",minute:"2-digit"});
const fl=v=>"৳"+Math.round(v).toLocaleString("en-IN");                       /* 10,00,000 style */
const bname=id=>(BANKS.find(b=>b.id===id)||{name:id}).name;
const stamp=d=>d===dk(Date.now())?Date.now():new Date(d+"T12:00:00+06:00").getTime();
const usedOn=(id,day)=>xfers.filter(x=>x.bank===id&&dk(x.t)===day).reduce((s,x)=>s+x.amount,0);
const resetText=()=>{const ms=86400000-((Date.now()+6*3600000)%86400000);return "Resets at 12:00 AM · in "+Math.floor(ms/3600000)+"h "+pad(Math.floor(ms%3600000/60000))+"m"};
let lastDay=dk(Date.now()),seededB=false;const openB=new Set();

function bankCards(){
  const day=dk(Date.now());lastDay=day;
  $("bkDate").textContent=new Date().toLocaleDateString("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",year:"numeric"});
  $("bkReset").textContent=resetText();
  const box=$("banks");box.textContent="";
  if(!bready){$("bkTot").textContent="—";BANKS.forEach(()=>box.appendChild(el("div","skel tall")));return}
  const sel=$("bk").value;let tot=0;
  BANKS.forEach(b=>{
    const u=usedOn(b.id,day);tot+=u;
    const pct=u/b.limit*100,st=pct>=100?"full":pct>=80?"warn":"";
    const c=el("div","bk"+(sel===b.id?" sel":""));
    const h=el("div","h"),amt=el("span","amt",fl(u));amt.appendChild(el("small",null," / "+fl(b.limit)));h.append(el("span","nm",b.name),amt);
    const bar=el("div","bar"),i=el("i",st);i.style.width=Math.min(100,pct)+"%";bar.appendChild(i);
    const left=u>b.limit?"Over by "+fl(u-b.limit):u===b.limit?"Limit full":fl(b.limit-u)+" left";
    const ft=el("div","ft");ft.append(el("span","left "+st,left),el("span","pc",Math.round(pct)+"%"));
    c.append(h,bar,ft);
    c.onclick=()=>{$("bk").value=b.id;bankCards();bhint()};
    box.appendChild(c);
  });
  $("bkTot").textContent=fl(tot);
}
function bhint(){
  if(!bready){$("bhint").textContent="";return}
  const b=BANKS.find(x=>x.id===$("bk").value),d=$("bdate").value||dk(Date.now()),u=usedOn(b.id,d),r=b.limit-u;
  $("bhint").textContent=b.name+" on "+d+": "+fl(u)+" used · "+(r>=0?fl(r)+" left":"over by "+fl(-r));
}
function xrow(x,withDate){
  const r=el("div","r"),l=el("div");
  const when=(withDate?new Date(x.t).toLocaleDateString("en-GB",{timeZone:TZ,day:"numeric",month:"short"})+" · ":"")+tz(x.t)+(x.note?" · "+x.note:"");
  l.append(el("span",null,bname(x.bank)),el("small",null,when));
  const b=el("button","x","✕");b.title="Delete";
  b.onclick=()=>{if(confirm("Delete this transfer?"))deleteDoc(doc(db,"bankTransfers",x.id)).catch(()=>toast("Could not delete"))};
  r.append(l,el("b",null,fl(x.amount)),b);return r;
}
function bankLatest(){
  const box=$("blist");box.textContent="";
  if(!bready){for(let i=0;i<3;i++)box.appendChild(el("div","skel"));return}
  const L=xfers.slice().sort((a,b)=>b.t-a.t).slice(0,5);
  if(!L.length){box.appendChild(el("div","card lock","No transfers yet."));return}
  const c=el("div","card");c.style.padding="2px 12px";L.forEach(x=>c.appendChild(xrow(x,true)));box.appendChild(c);
}
function bankDate(){
  const box=$("dres"),d=$("cd").value;box.textContent="";
  if(!d){box.appendChild(el("div","note","Pick a date to see how much was transferred from each bank on that day."));return}
  if(!bready)return;
  let tot=0;
  BANKS.forEach(b=>{
    const u=usedOn(b.id,d);tot+=u;const pct=u/b.limit*100,st=pct>=100?"full":pct>=80?"warn":"";
    const row=el("div","dbk"),h=el("div","h"),amt=el("span","amt",fl(u));amt.appendChild(el("small",null," / "+fl(b.limit)));
    h.append(el("span","nm",b.name),amt);
    const bar=el("div","bar"),i=el("i",st);i.style.width=Math.min(100,pct)+"%";bar.appendChild(i);
    row.append(h,bar);box.appendChild(row);
  });
  const t=el("div","mrow");t.append(el("span",null,"Total on "+d),el("b",null,fl(tot)));box.appendChild(t);
  xfers.filter(x=>dk(x.t)===d).sort((x,y)=>y.t-x.t).forEach(x=>box.appendChild(xrow(x,false)));
}
function bankMonth(){
  const m=$("bm").value||mk(Date.now()),mb=$("mbanks");mb.textContent="";
  if(!bready){["mt","mc","md","ma"].forEach(i=>$(i).textContent="—");return}
  const L=xfers.filter(x=>mk(x.t)===m),tot=L.reduce((s,x)=>s+x.amount,0),days=new Set(L.map(x=>dk(x.t)));
  $("mt").textContent=fl(tot);$("mc").textContent=L.length;$("md").textContent=days.size;
  $("ma").textContent=fl(days.size?tot/days.size:0);
  BANKS.forEach(b=>{
    const bl=L.filter(x=>x.bank===b.id),s=bl.reduce((q,x)=>q+x.amount,0);
    const r=el("div","mrow"),l=el("span",null,b.name);l.appendChild(el("small",null,bl.length+" transfer"+(bl.length===1?"":"s")));
    r.append(l,el("b",null,fl(s)));mb.appendChild(r);
  });
}
function bankRender(){if(!isAdmin)return;bankCards();bankLatest();bankDate();bankMonth();bhint()}

/* form + controls */
BANKS.forEach(b=>{const o=document.createElement("option");o.value=b.id;o.textContent=b.name;$("bk").appendChild(o)});
$("bdate").value=dk(Date.now());$("bm").value=mk(Date.now());
$("bk").addEventListener("change",()=>{bankCards();bhint()});
$("bdate").addEventListener("change",bhint);
$("bm").addEventListener("change",bankMonth);
$("cd").addEventListener("change",bankDate);
$("bkAdd").onclick=async()=>{
  if(!isAdmin)return;
  const a=parseFloat($("bamt").value),id=$("bk").value,d=$("bdate").value||dk(Date.now());
  if(!(a>0)){toast("Enter amount");return}
  const b=BANKS.find(x=>x.id===id),u=usedOn(id,d);
  if(u+a>b.limit&&!confirm(b.name+" will cross its daily limit: "+fl(u+a)+" / "+fl(b.limit)+". Save anyway?"))return;
  addDoc(collection(db,"bankTransfers"),{t:stamp(d),bank:id,amount:a,note:$("bnote").value.trim()}).catch(()=>toast("Could not save"));
  $("bamt").value="";$("bnote").value="";toast("Transfer saved ✓");
};
$("bxl").onclick=async()=>{
  const m=$("bm").value||mk(Date.now()),L=xfers.filter(x=>mk(x.t)===m).slice().reverse();
  if(!L.length){toast("Nothing to export");return}
  try{await loadXLSX()}catch(e){toast("Could not load Excel tool");return}
  const rows=L.map(x=>({"Date":dk(x.t),"Time":tz(x.t),"Bank":bname(x.bank),"Amount (BDT)":x.amount,"Note":x.note||""}));
  rows.push({"Date":"TOTAL","Amount (BDT)":L.reduce((s,x)=>s+x.amount,0)});
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
  ws["!cols"]=[{wch:12},{wch:10},{wch:10},{wch:14},{wch:24}];
  XLSX.utils.book_append_sheet(wb,ws,"Transfers");
  const sm=BANKS.map(b=>({"Bank":b.name,"Transfers":L.filter(x=>x.bank===b.id).length,"Amount (BDT)":L.filter(x=>x.bank===b.id).reduce((s,x)=>s+x.amount,0)}));
  sm.push({"Bank":"TOTAL","Transfers":L.length,"Amount (BDT)":L.reduce((s,x)=>s+x.amount,0)});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sm),"Summary");
  XLSX.writeFile(wb,"bank_transfers_"+m+".xlsx");
};

/* midnight (Dhaka) reset: refresh the countdown and re-render when the day changes */
function tick(){
  if(!isAdmin||!bready)return;
  $("bkReset").textContent=resetText();
  if(dk(Date.now())!==lastDay){
    if($("bdate").value===lastDay)$("bdate").value=dk(Date.now());
    bankRender();
  }
}
setInterval(tick,15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick()});
bankRender();
