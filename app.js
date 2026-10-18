import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,addDoc,deleteDoc,doc,onSnapshot,query,orderBy} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
["buy","sell","fee","qty"].forEach(i=>$(i).addEventListener("input",live));live();

/* ---------- auth ---------- */
if(configured){
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,u=>{
    isAdmin=!!u;ui();
    if(unsub){unsub();unsub=null}
    if(u){
      unsub=onSnapshot(query(collection(db,"trades"),orderBy("t","desc")),
        s=>{trades=s.docs.map(d=>({id:d.id,...d.data()}));render()},
        ()=>toast("Access denied: this account is not the admin"));
    }else{trades=[];render()}
  });
}
function ui(){
  $("authBtn").textContent=isAdmin?"Log out":"Admin login";
  $("admin").classList.toggle("hide",!isAdmin);
  $("locked").classList.toggle("hide",isAdmin);
  $("add").classList.toggle("hide",!isAdmin);
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
    await addDoc(collection(db,"trades"),{t:Date.now(),buy:n("buy"),sell:n("sell"),fee:n("fee"),qty:n("qty"),profit:calc().tot});
    toast("Saved to history ✓");
  }catch(e){toast("Could not save")}
};

/* ---------- history (admin) ---------- */
function filtered(){const a=$("from").value,b=$("to").value;return trades.filter(x=>{const d=ymd(new Date(x.t));return(!a||d>=a)&&(!b||d<=b)})}
function render(){
  if(!isAdmin)return;
  const L=filtered(),sum=L.reduce((s,x)=>s+x.profit,0),all=trades.reduce((s,x)=>s+x.profit,0);
  $("sp").textContent=f(sum);$("sp").className=sum<0?"neg":"pos";
  $("sc").textContent=L.length;$("sq").textContent=L.reduce((s,x)=>s+x.qty,0).toLocaleString("en-US");
  $("sa").textContent=f(all);
  $("barFill").style.width=(all>0?Math.min(100,Math.max(0,sum/all*100)):0)+"%";
  const box=$("list");box.textContent="";
  if(!L.length){box.appendChild(el("div","card lock","No trades found for this period."));return}
  const g=new Map();L.forEach(x=>{const k=ymd(new Date(x.t));(g.get(k)||g.set(k,[]).get(k)).push(x)});
  let first=true;
  g.forEach((arr,k)=>{
    const d=el("details");if(first){d.open=true;first=false}
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
      b.onclick=async()=>{if(confirm("Delete this trade?")){try{await deleteDoc(doc(db,"trades",x.id))}catch(e){toast("Could not delete")}}};
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
$("xl").onclick=()=>{
  const L=filtered();if(!L.length){toast("Nothing to export");return}
  const rows=L.map(x=>({"Date":ymd(new Date(x.t)),"Time":tm(x.t),"Buy price":x.buy,"Sale price":x.sell,"Fee %":x.fee,"USDT qty":x.qty,"Net profit (BDT)":+x.profit.toFixed(2)}));
  rows.push({"Date":"TOTAL","Net profit (BDT)":+L.reduce((s,x)=>s+x.profit,0).toFixed(2)});
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
  ws["!cols"]=[{wch:12},{wch:10},{wch:11},{wch:11},{wch:8},{wch:10},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws,"Profit");
  XLSX.writeFile(wb,"usdt_profit_"+ymd(new Date())+".xlsx");
};
