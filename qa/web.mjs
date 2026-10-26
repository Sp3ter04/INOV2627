// Testa a versão web com um Supabase simulado (mesmas regras de RLS).
import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import fs from "fs"; import path from "path";
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const MIG=process.env.MIG;
const CODE="codigo-teste-123";
const W=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(c,m,x="")=>console.log((c?"OK   ":"FAIL ")+m,x);
const store=new Map();
for(const col of fs.readdirSync(MIG))for(const f of fs.readdirSync(MIG+"/"+col)){const d=JSON.parse(fs.readFileSync(`${MIG}/${col}/${f}`,"utf8"));store.set(col+"/"+(d.id||f.slice(0,-5)),{col,id:d.id||f.slice(0,-5),data:d.data||d});}
const PUB_R=["ideias","sessoes","live","fotos","config","feedback"],PUB_W=["ideias","feedback","pedidos"];
function handle(route){
  const req=route.request(),u=new URL(req.url()),h=req.headers(),coord=h["x-inov-code"]===CODE;
  const p=u.pathname.replace("/rest/v1/","");
  if(p==="rpc/inov_coord")return route.fulfill({json:coord});
  const q=k=>{const v=u.searchParams.get(k);return v&&v.startsWith("eq.")?v.slice(3):null;};
  const m=req.method();
  if(m==="GET"){const col=q("col"),id=q("id");const rows=[...store.values()].filter(r=>(!col||r.col===col)&&(!id||r.id===id)&&(coord||PUB_R.includes(r.col)));return route.fulfill({json:rows.map(r=>({id:r.id,col:r.col,data:r.data}))});}
  if(m==="POST"){let b=JSON.parse(req.postData());b=Array.isArray(b)?b:[b];if(b.some(r=>!coord&&!(PUB_W.includes(r.col)&&(!store.has(r.col+"/"+r.id)||["ideias","feedback"].includes(r.col)))))return route.fulfill({status:403,body:"rls"});b.forEach(r=>store.set(r.col+"/"+r.id,{col:r.col,id:r.id,data:r.data}));return route.fulfill({status:201,body:""});}
  if(m==="DELETE"){const col=q("col"),id=q("id");if(!coord&&!["ideias","feedback"].includes(col))return route.fulfill({status:204,body:""});store.delete(col+"/"+id);return route.fulfill({status:204,body:""});}
  return route.fulfill({status:400,body:"?"});
}
const b=await chromium.launch();
async function open(pathname,{code,w}={}){
  const c=await b.newContext({viewport:{width:w||1250,height:900}});
  await c.route(/fonts\.g/,r=>r.abort());
  await c.route(/supabase\.co/,handle);
  await c.route(/^http:\/\/inov\.test\//,r=>{const u=new URL(r.request().url());let f=u.pathname==="/"||u.pathname.startsWith("/juri")||u.pathname.startsWith("/coordenador")?"index.html":u.pathname.slice(1);return r.fulfill({path:ROOT+"/public/"+f,contentType:f.endsWith(".js")?"application/javascript":"text/html"});});
  const p=await c.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));
  if(code)await c.addInitScript(`localStorage.setItem("inov-coord-code",${JSON.stringify(code)})`);
  await p.goto("http://inov.test"+pathname);await W(1500);return p;
}
// 1. /coordenador sem código: ecrã de entrada
const R=await open("/coordenador");
ok(await R.locator("#inov-login").count()===1,"raiz pede código de coordenador");
ok(await R.locator('[data-go="kpis"]').count()===0,"sem menu de coordenador");
await R.fill("#inov-code","errado");await R.click('#inov-login button');await W(500);
ok(await R.locator("#inov-login-err").isVisible(),"código errado recusado");
await R.fill("#inov-code",CODE);await R.click('#inov-login button');await W(2000);
ok(await R.locator('[data-go="kpis"]').count()===1,"código certo abre vista de coordenador");
// 2. júri
const J=await open("/juri",{w:390});
ok(await J.locator(".app.jmode").count()===1,"/juri abre o painel do júri");
ok(await J.locator('[data-go="kpis"],[data-go="defs"]').count()===0,"júri sem vista de coordenador");
ok(await J.locator('form[data-form="liveidea"]').count()===1,"júri pode registar ideias");
await J.fill('form[data-form="jname"] input[name="n"]',"Jurado Web");await J.click('form[data-form="jname"] button');await W(400);
const first=await J.locator('[data-act="verd"]').first();
const iid=await first.getAttribute("data-id");
await J.click(`[data-act="verd"][data-id="${iid}"][data-v="gosto"]`);await W(150);
await J.click(`[data-act="fbsend"][data-id="${iid}"]`);await W(1200);
ok([...store.values()].some(r=>r.col==="feedback"&&r.data.ideiaId===iid&&r.data.jurado==="Jurado Web"),"júri grava veredito no Supabase");
await J.fill('form[data-form="liveidea"] input[name="titulo"]',"Ideia web");await J.click('form[data-form="liveidea"] button[type="submit"]');await W(1200);
ok([...store.values()].some(r=>r.col==="ideias"&&r.data.titulo==="Ideia web"),"júri regista ideia");
ok(await J.evaluate(()=>document.documentElement.scrollWidth<=390),"júri cabe em 390 px");
// 3. júri não lê dados privados
const priv=await J.evaluate(async()=>{const db=await window.claude.use("db");const s=await db.collection("crm").get();return s.docs.length;});
ok(priv===0,"júri não lê o CRM",priv);
const w=await J.evaluate(async()=>{const db=await window.claude.use("db");try{await db.collection("config").doc("main").set({x:1});return "gravou";}catch(e){return e.code;}});
ok(w==="permission-denied","júri não altera config",w);
// 4. coordenador vê KPIs e ferramenta de cópia
const C=await open("/coordenador",{code:CODE});await C.click('[data-go="defs"]');await W(600);
ok(await C.locator("#inov-export").count()===1,"Definições: cópia de segurança");
ok(R.errs.length+J.errs.length+C.errs.length===0,"sem erros JS",R.errs.concat(J.errs,C.errs).join("|"));
await b.close();
