// Testa o painel do júri do Challenge II (agenda, speakers, sem Business model, chat do júri, acesso só ao Challenge II), com um Supabase simulado.
// Corre: node qa/juri_c2.mjs
import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "path";
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const CODE="codigo-teste-123",JCODE="1fh73r",PDFJS="/tmp/pdfjs4/package/build/";
const W=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m,x="")=>{if(!c)fails++;console.log((c?"OK   ":"FAIL ")+m,x);};
const store=new Map();const put=(col,d)=>store.set(col+"/"+d.id,{col,id:d.id,data:d,updated_at:new Date(Date.now()-3600e3).toISOString()});
let bytes=0,gets=0;
const I=(id,titulo,par,extra={})=>put("ideias",Object.assign({id,titulo,etapa:"sd",par,sessao:4,gosto:4,problema:"Problema de "+titulo,solucao:"Solução de "+titulo},extra));
I("s1","Orçamentação",["Guilherme D.","Xavier S.","Maria P."]);
I("s2","Notas de alta",["Rita M.","Francisca O."]);
I("s3","Registo de avarias",["Matilde S.","Lourenço S."]);
I("s4","Já startup",["Afonso M."],{etapa:"startup"});
I("c2x","Ficou no Challenge II",["Inês F."],{etapa:"c2"});
put("config",{id:"main",juriFase:"sd",fases:{
  c1:{nome:"Challenge I",data:"2026-11-03",min:0,max:10,juri:[]},c2:{nome:"Challenge II",data:"2026-11-13",min:0,max:10,juri:[]},
  sd:{nome:"Selection Day",data:"2026-11-25",min:0,max:10,juri:["Miguel Gomes","Gabriela Gomes"],ordem:["s1","s2","s3"]}}});
put("fotos",{id:"main",fotos:{}});
const uploads=[],removed=[];
put("materiais",{id:"old1",ideiaId:"s1",ficheiro:"slides-c2.pdf",path:"s1/c2-old.pdf",tipo:"Slides do pitch",fase:"c2",em:"2026-11-10"});
put("materiais",{id:"old2",ideiaId:"s1",ficheiro:"slides-c1.pdf",path:"s1/old.pdf",tipo:"Slides do pitch",em:"2026-11-01"});
put("materiais",{id:"m-res",ideiaId:"s1",ficheiro:"Resumo.docx",path:"s1/res.docx",tipo:"Resumo Executivo",em:"2026-11-20"});
put("materiais",{id:"m-mvp",ideiaId:"s1",ficheiro:"MVP Figma",url:"https://figma.com/x",tipo:"MVP / protótipo",fase:"sd",em:"2026-11-20"});
put("materiais",{id:"m-c1s",ideiaId:"s1",ficheiro:"slides-c1-novo.pdf",path:"s1/c1.pdf",tipo:"Slides Challenge I",fase:"c1",em:"2026-11-20"});
put("materiais",{id:"new1",ideiaId:"s2",ficheiro:"sd-notas.pdf",path:"s2/sd-new.pdf",tipo:"Slides do pitch",fase:"sd",em:"2026-11-20"});
const PUB=["ideias","sessoes","live","fotos","config","feedback"];
function handle(route){
  const req=route.request(),u=new URL(req.url()),h=req.headers(),code=h["x-inov-code"],coord=code===CODE,juri=code===JCODE,m=req.method();
  if(u.pathname.endsWith("/x.pdf"))return route.fulfill({path:"/tmp/slides.pdf",contentType:"application/pdf",headers:{"access-control-allow-origin":"*"}});
  if(u.pathname.startsWith("/storage/v1/object/sign/"))return (coord||juri)?route.fulfill({json:{signedURL:"/object/sign/materiais/x.pdf?token=1"}}):route.fulfill({status:400,json:{}});
  if(u.pathname.startsWith("/storage/v1/object/materiais")&&!u.pathname.includes("/sign/")){
    if(!coord)return route.fulfill({status:403,json:{message:"rls"}});
    if(m==="POST"){uploads.push({path:decodeURIComponent(u.pathname.replace("/storage/v1/object/materiais/","")),size:(req.postDataBuffer()||[]).length});return route.fulfill({json:{Key:"ok"}});}
    if(m==="DELETE"){removed.push(...JSON.parse(req.postData()).prefixes);return route.fulfill({json:[]});}}
  const p=u.pathname.replace("/rest/v1/","");
  if(p==="rpc/inov_coord")return route.fulfill({json:coord});
  if(p==="rpc/inov_juri")return route.fulfill({json:juri});
  const q=k=>{const v=u.searchParams.get(k);return v&&v.startsWith("eq.")?v.slice(3):null;};
  if(m==="GET"){const col=q("col"),id=q("id");const rawId=u.searchParams.get("id"),idf=rawId?(rawId.startsWith("in.(")?(x=>rawId.slice(4,-1).split(",").map(z=>decodeURIComponent(z).replace(/^"|"$/g,"")).includes(x)):(x=>x===id)):null;const gt=u.searchParams.get("updated_at"),since=gt&&gt.startsWith("gt.")?Date.parse(gt.slice(3)):0;const rows=[...store.values()].filter(r=>(!col||r.col===col)&&(!idf||idf(r.id))&&(!since||Date.parse(r.updated_at)>since)&&(coord||PUB.includes(r.col)||(juri&&r.col==="materiais")));const out=rows.map(r=>({id:r.id,col:r.col,data:/data/.test(u.searchParams.get("select")||"")?r.data:undefined,updated_at:r.updated_at}));gets++;bytes+=JSON.stringify(out).length;return route.fulfill({json:out,headers:{date:new Date().toUTCString(),"access-control-expose-headers":"Date"}});}
  if(m==="POST"){let b=JSON.parse(req.postData());b=Array.isArray(b)?b:[b];if(b.some(r=>!coord&&!["ideias","feedback","pedidos"].includes(r.col)))return route.fulfill({status:403,body:"rls"});b.forEach(r=>store.set(r.col+"/"+r.id,{col:r.col,id:r.id,data:r.data,updated_at:r.updated_at||new Date().toISOString()}));return route.fulfill({status:201,body:""});}
  if(m==="DELETE"){store.delete(q("col")+"/"+q("id"));return route.fulfill({status:204,body:""});}
  return route.fulfill({status:400,body:"?"});
}
const b=await chromium.launch();
async function open(pathname,{code,w,h,jurado}={}){
  const c=await b.newContext({viewport:{width:w||1280,height:h||900}});
  await c.route(/fonts\.g/,r=>r.abort());await c.route(/supabase\.co/,handle);
  await c.route(/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@4\.10\.38\/build\//,r=>{const f=new URL(r.request().url()).pathname.split("/").pop();return r.fulfill({path:PDFJS+f,contentType:"text/javascript",headers:{"access-control-allow-origin":"*"}});});
  await c.route(/^http:\/\/inov\.test\//,r=>{const u=new URL(r.request().url());let f=u.pathname.startsWith("/membro")?"membro.html":u.pathname==="/"||u.pathname.startsWith("/juri")||u.pathname.startsWith("/coordenador")?"app.html":u.pathname.slice(1);return r.fulfill({path:ROOT+"/public/"+f,contentType:f.endsWith(".js")?"application/javascript":"text/html"});});
  const p=await c.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/favicon|Failed to load resource/.test(m.text()))p.errs.push("console: "+m.text());});
  if(code)await c.addInitScript(`localStorage.setItem("inov-coord-code",${JSON.stringify(code)})`);
  if(jurado)await c.addInitScript(`localStorage.setItem("inov-jurado",${JSON.stringify(jurado)})`);
  await p.goto("http://inov.test"+pathname);await W(1500);return p;
}
const cfg=()=>(store.get("config/main")||{data:{}}).data;
const cfgLive=()=>(store.get("live/estado")||{data:{}}).data;
const doc=id=>(store.get("feedback/"+id)||{}).data;
const A=await open("/juri",{code:JCODE});
await A.click('[data-act="jset"][data-v="Miguel Gomes"]');await W(600);
ok((await A.locator(".jhero h1").textContent())==="Selection Day","júri abre no Selection Day");
ok((await A.locator(".c1bar .pairchip b.c1n").allTextContents()).join()==="1,2,3,4","3 do SD + a que já virou startup, por ordem",(await A.locator(".c1bar").textContent()));
ok(!(await A.locator(".c1bar").textContent()).includes("Challenge II"),"a ideia que ficou no Challenge II não aparece");
await A.click('[data-act="c1tab"][data-v="todas"]');await W(300);
await A.locator('[data-c1open^="all-s1"] summary').first().click().catch(()=>{});
await A.evaluate(()=>document.querySelectorAll("details").forEach(d=>d.open=true));await W(200);
const t=await A.locator("#c1list").textContent();
ok(!t.includes("slides-c2.pdf")&&!t.includes("slides-c1.pdf"),"slides antigos (C1/C2) não aparecem no SD");
ok(t.includes("sd-notas.pdf")||await A.locator(".c1slbtn").count()>0,"slides do SD aparecem");
ok(t.includes("Resumo.docx")&&t.includes("MVP Figma"),"Resumo Executivo e MVP aparecem ao júri do SD");
ok(!t.includes("slides-c1-novo.pdf"),"slides do Challenge I não aparecem no SD");
ok(await A.locator(".jc-ppl .chipp").count()>=6,"as 3 pessoas aparecem nos cartões");
// top 3
await A.click('[data-act="c1tab"][data-v="top3"]');await W(300);
const btns=A.locator('[data-act="c1pick"]');
ok(await btns.count()===4,"4 ideias para escolher");
for(let k=0;k<4;k++){await btns.nth(k).click();await W(150);}
await W(1500);const d=doc("sdpick__miguel-gomes");console.log(JSON.stringify(d));
ok(d&&d.ids.length===3&&d.tipo==="sdpick","máx. 3 escolhas guardadas",JSON.stringify(d&&d.ids));
await A.click('[data-act="c1pick"][aria-pressed="true"]');await W(200);
await W(1500);ok(doc("sdpick__miguel-gomes").ids.length===2,"tirar uma escolha");
// avaliação no SD guarda sdaval
await A.click('[data-act="c1tab"][data-v="apres"]');await W(300);
await A.locator(".c1sc button[data-v=\"4\"]").first().click();await W(1500);
ok([...store.keys()].some(k=>k.startsWith("feedback/sd__")),"avaliação guardada em sdaval",[...store.keys()].filter(k=>k.includes("sd")).join());
ok(A.errs.length===0,"sem erros no júri",A.errs.join("|"));
// coordenador: carregar PowerPoint do SD
const C=await open("/coordenador",{code:CODE});
await C.click('[data-go="hub"]');await W(400);await C.click('[data-tab="hub:sd"]');await W(600);
// temporizador Q&A iniciado na aba do júri do coordenador (/coordenador/juri)
const H=await open("/coordenador/juri",{code:CODE,jurado:"Miguel Gomes"});
ok(await H.locator("#qapill.idle").count()===1&&/Iniciar para todos/.test(await H.locator("#qapill").textContent()),"coordenador vê «Iniciar para todos» no painel do júri");
ok(await A.locator("#qapill").count()===0,"o jurado não vê nada enquanto não inicia");
await H.click('#qapill [data-v="start"]');await W(5000);
const pj=await A.locator("#qapill b").textContent().catch(()=>"");
ok(/^[56]:\d\d$/.test(pj),"ao iniciar no painel do júri, o jurado vê o tempo",pj);
await H.click('#qapill [data-v="reset"]');await W(4500);
ok(await A.locator("#qapill").count()===0,"repor no painel do júri esconde o selo ao jurado");
// dono em /juri (não /coordenador): sem controlos do cronómetro e sem botão «Sessões de ideação»
const J2=await open("/juri",{code:CODE,jurado:"Miguel Gomes"});
ok(await J2.locator('[data-act="c1qa"]').count()===0,"em /juri nem o coordenador tem controlos do cronómetro");
ok(await H.getByText("Sessões de ideação",{exact:true}).count()===0,"sem botão «Sessões de ideação» no painel do júri");
// egress: em repouso só chegam alterações
const b0=bytes,g0=gets;await W(12000);
console.log("repouso 12 s:",gets-g0,"pedidos,",bytes-b0,"bytes (coleção completa ≈",JSON.stringify([...store.values()].map(r=>r.data)).length,")");
ok(bytes-b0<12000,"em repouso quase não há dados a descer",String(bytes-b0));
// temporizador Q&A
ok(await A.locator("#qapill").count()===0,"sem selo quando o timer não foi iniciado");
await C.click('[data-act="c1qa"][data-v="start"]');await W(5500);
const pt=await A.locator("#qapill b").textContent().catch(()=>"");
ok(/^[56]:\d\d$/.test(pt)&&pt!=="0:00","júri vê o timer a contar",pt);
ok(await A.evaluate(()=>getComputedStyle(document.getElementById("qapill")).pointerEvents)==="none","selo do júri não bloqueia cliques");
ok(await A.locator("#qapill button").count()===0,"júri sem botões no selo");
// o júri não consegue parar nem repor, nem com um botão injetado nem escrevendo na base de dados
await A.evaluate(()=>{const x=document.createElement("button");x.dataset.act="c1qa";x.dataset.v="reset";x.id="hack";document.body.appendChild(x);x.click();});await W(800);
ok(await A.locator("#qapill").count()===1&&!!(cfgLive().qa&&cfgLive().qa.fim),"botão injetado pelo júri não pára o timer");
const w=await A.evaluate(async()=>{const r=await fetch("https://x.supabase.co/rest/v1/docs?on_conflict=col,id",{method:"POST",headers:{"x-inov-code":"1fh73r","content-type":"application/json"},body:JSON.stringify({col:"live",id:"estado",data:{id:"estado",qa:null}})});return r.status;});
ok(w===403&&!!(cfgLive().qa&&cfgLive().qa.fim),"o júri não consegue escrever o estado ao vivo (403)",String(w));
await C.click('#qapill [data-v="pause"]');await W(5000);
const p1=await A.locator("#qapill b").textContent();await W(2200);const p2=await A.locator("#qapill b").textContent();
ok(p1===p2&&/em pausa/.test(await A.locator("#qapill").textContent()),"pausa congela",p1+" "+p2);
await C.click('#qapill [data-v="start"]');await W(500);
// perto do fim
await C.evaluate(()=>{const L=Object.assign({},S.live.get("estado"),{qa:{fim:Date.now()+30000}});S.live.set("estado",L);save("live","estado");});await W(5000);
ok(await A.locator("#qapill.warn").count()===1,"último minuto fica âmbar");
await C.evaluate(()=>{const L=Object.assign({},S.live.get("estado"),{qa:{fim:Date.now()-1000}});S.live.set("estado",L);save("live","estado");});await W(5000);
ok(await A.locator("#qapill.end").count()===1&&/Tempo/.test(await A.locator("#qapill").textContent()),"a zero mostra «Tempo!»");
await C.click('#qapill [data-v="reset"]');await W(5000);
ok(await A.locator("#qapill").count()===0,"repor esconde o selo");
console.log("upload inputs:",await C.locator('input[data-c2up]').count());
const inp=C.locator('input[data-c2up="s1"]');
if(await inp.count()){await C.evaluate(()=>{window.INOV_UPLOAD=window.INOV_UPLOAD||(async(p,f)=>fetch("https://x.supabase.co/storage/v1/object/materiais/"+p,{method:"POST",body:f}));});
 await inp.setInputFiles({name:"SD Orçamentação.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:Buffer.from("PK-fake")});await W(1500);
 const mats=[...store.values()].filter(r=>r.col==="materiais").map(r=>r.data);
 ok(mats.some(m=>m.fase==="sd"&&m.ideiaId==="s1"&&/\.pptx$/.test(m.ficheiro)),"pptx guardado com fase sd");
 ok(mats.some(m=>m.id==="old1")&&mats.some(m=>m.id==="old2"),"slides antigos (C1/C2) mantidos");
 await C.click('[data-tab="hub:ideias"]');await W(500);}
else ok(false,"input de carregamento do SD");
console.log(fails?"FALHOU "+fails:"TUDO OK");await b.close();process.exit(fails?1:0);
