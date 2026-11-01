// Testa o painel do júri do Challenge I e a vista do coordenador (ordem e resultados), com um Supabase simulado.
// Precisa de /tmp/slides.pdf (3 páginas) e do pdf.js 4.10.38 em /tmp/pdfjs4/package/build.
import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "path";
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const CODE="codigo-teste-123",JCODE="1fh73r",PDFJS="/tmp/pdfjs4/package/build/";
const W=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m,x="")=>{if(!c)fails++;console.log((c?"OK   ":"FAIL ")+m,x);};
const store=new Map();const put=(col,d)=>store.set(col+"/"+d.id,{col,id:d.id,data:d});
const I=(id,titulo,par,extra={})=>put("ideias",Object.assign({id,titulo,etapa:"c1",par,sessao:4,gosto:4,problema:"Problema de "+titulo+". ".repeat(1)+"Muito texto. ".repeat(40),solucao:"Solução de "+titulo},extra));
I("a1","Orçamentação (Memória de Projeto)",["Guilherme D.","Xavier S."],{resumoJuri:"Problema real e validação muito bem feita."});
I("a2","Notas de alta assistidas por IA",["Rita M.","Guilherme D."],{resumoJuri:"Validação forte com médicos."});
I("a3","Passaporte",["Xavier S.","Lourenço S.","Maria P."],{gosto:5});
put("ideias",{id:"z9",titulo:"Ideia que não passou",etapa:"ideacao",par:["Inês F."],sessao:2});
put("materiais",{id:"m1",ideiaId:"a1",ficheiro:"pitch-orcamentacao.pdf",path:"a1/pitch.pdf",tipo:"Slides do pitch",nome:"Xavier S.",email:"x@j.pt",em:"2026-11-01"});
put("materiais",{id:"m2",ideiaId:"a1",ficheiro:"MVP no Figma",url:"https://figma.com/x",tipo:"MVP / protótipo",nome:"Xavier S.",email:"x@j.pt",em:"2026-11-01"});
put("materiais",{id:"m3",ideiaId:"a1",ficheiro:"entrevistas.pdf",path:"a1/entrevistas.pdf",tipo:"Validação de mercado",nome:"Xavier S.",email:"x@j.pt",em:"2026-11-01"});
put("fotos",{id:"main",fotos:{}});
const PUB=["ideias","sessoes","live","fotos","config","feedback"];
function handle(route){
  const req=route.request(),u=new URL(req.url()),h=req.headers(),code=h["x-inov-code"],coord=code===CODE,juri=code===JCODE,m=req.method();
  if(u.pathname.endsWith("/x.pdf"))return route.fulfill({path:"/tmp/slides.pdf",contentType:"application/pdf",headers:{"access-control-allow-origin":"*"}});
  if(u.pathname.startsWith("/storage/v1/object/sign/"))return (coord||juri)?route.fulfill({json:{signedURL:"/object/sign/materiais/x.pdf?token=1"}}):route.fulfill({status:400,json:{}});
  const p=u.pathname.replace("/rest/v1/","");
  if(p==="rpc/inov_coord")return route.fulfill({json:coord});
  if(p==="rpc/inov_juri")return route.fulfill({json:juri});
  const q=k=>{const v=u.searchParams.get(k);return v&&v.startsWith("eq.")?v.slice(3):null;};
  if(m==="GET"){const col=q("col"),id=q("id");const rows=[...store.values()].filter(r=>(!col||r.col===col)&&(!id||r.id===id)&&(coord||PUB.includes(r.col)||(juri&&r.col==="materiais")));return route.fulfill({json:rows.map(r=>({id:r.id,col:r.col,data:r.data}))});}
  if(m==="POST"){let b=JSON.parse(req.postData());b=Array.isArray(b)?b:[b];if(b.some(r=>!coord&&!["ideias","feedback","pedidos"].includes(r.col)))return route.fulfill({status:403,body:"rls"});b.forEach(r=>store.set(r.col+"/"+r.id,{col:r.col,id:r.id,data:r.data}));return route.fulfill({status:201,body:""});}
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
// 1. Coordenador: ordem e «agora»
const C=await open("/coordenador",{code:CODE});
await C.click('[data-go="hub"]');await W(300);await C.click('[data-tab="hub:c1"]');await W(500);
ok(await C.locator("h2",{hasText:"Apresentações e avaliação do júri"}).count()===1,"coordenador: cartão de apresentações no Challenge I");
const ord0=await C.locator(".c1ord .c1ot b").allTextContents();
ok(ord0.length===3,"ordem lista as 3 ideias do Challenge I",ord0.join(" | "));
await C.locator(".c1ord li").nth(2).locator('[data-act="c1mv"][data-v="-1"]').click();await W(800);
const ord1=await C.locator(".c1ord .c1ot b").allTextContents();
ok(ord1[1]===ord0[2]&&ord1[2]===ord0[1],"↑ troca a ordem");
ok(Array.isArray(cfg().fases&&cfg().fases.c1&&cfg().fases.c1.ordem)&&cfg().fases.c1.ordem.length===3,"ordem gravada em config");
await C.locator(".c1ord li").nth(0).locator('[data-c1pos]').fill("3");await C.locator(".c1ord li").nth(0).locator('[data-c1pos]').dispatchEvent("change");await W(800);
const ord2=await C.locator(".c1ord .c1ot b").allTextContents();
ok(ord2[2]===ord1[0],"posição escrita move a ideia");
const firstTitle=ord2[0];
await C.locator(".c1ord li").nth(0).locator('[data-act="c1now"]').click();await W(800);
const live=(store.get("live/estado")||{data:{}}).data;
ok(!!live.c1Atual,"«Agora» grava a ideia a apresentar",live.c1Atual);
// 2. Júri
const J=await open("/juri",{code:JCODE});
ok(await J.locator(".wcard").count()>0,"júri escolhe o nome");
await J.click('[data-act="jset"][data-v="Miguel Gomes"]');await W(600);
ok((await J.locator(".jhero h1").textContent())==="Challenge I","júri abre no Challenge I");
ok(await J.locator(".c1bar .pairchip").count()===3,"barra com a ordem das 3 apresentações");
ok((await J.locator(".c1title").textContent())===firstTitle,"mostra a ideia a apresentar agora",firstTitle);
ok(await J.locator(".c1bar .pairchip[aria-pressed=true] .now").count()===1,"chip marcado «agora»");
// ir para Orçamentação (tem slides)
const orcId="a1";await J.click(`.c1bar [data-act="c1go"][data-id="${orcId}"]`);await W(400);
ok((await J.locator(".c1title").textContent()).startsWith("Orçamentação"),"navegar pela barra");
ok(await J.locator(".c1ppl figure").count()===2&&await J.locator(".c1ppl .c1sc").count()===2,"pessoas com nota de pitch por baixo");
await J.click('.c1ppl figure:nth-child(1) [data-act="c1pitch"][data-v="4"]');await W(200);
await J.click('.c1ppl figure:nth-child(2) [data-act="c1pitch"][data-v="3"]');await W(200);
const crit=["problema","validacao","solucao","escalabilidade","viabilidade","negocio"],vals=[5,4,4,3,4,2];
for(let k=0;k<6;k++){await J.click(`[data-act="c1nota"][data-c="${crit[k]}"][data-v="${vals[k]}"]`);await W(120);}
ok((await J.locator(".c1avg b").textContent())==="3,7","média ao vivo (3,7)");
await J.fill(`#c1q-${orcId}`,"Quanto pagaria uma construtora?");await J.fill(`#c1f-${orcId}`,"Boa validação; testem o pricing.");await W(1500);
const doc=(store.get(`feedback/c1__${orcId}__miguel-gomes`)||{}).data;
ok(doc&&doc.tipo==="c1aval"&&doc.notas.negocio===2&&doc.pitch["Guilherme D."]===4&&doc.perguntas.includes("construtora")&&doc.feedback.includes("pricing"),"avaliação gravada (notas, pitch, perguntas, feedback)");
ok(await J.locator(".c1bar .pairchip[aria-pressed=true] .c1ok").count()===1,"chip mostra ✓ quando completa");
await J.click('[data-act="c1nota"][data-c="negocio"][data-v="2"]');await W(900);
ok((store.get(`feedback/c1__${orcId}__miguel-gomes`).data.notas.negocio)===undefined&&await J.locator('[data-act="c1nota"][data-c="negocio"][aria-pressed=true]').count()===0,"clicar outra vez apaga a nota");
ok(await J.locator(".c1bar .pairchip[aria-pressed=true] .c1ok").count()===0,"sem a nota, deixa de estar completa");
await J.click('.c1ppl figure:nth-child(1) [data-act="c1pitch"][data-v="4"]');await W(900);
ok(store.get(`feedback/c1__${orcId}__miguel-gomes`).data.pitch["Guilherme D."]===undefined,"clicar outra vez apaga a nota do pitch");
await J.click('[data-act="c1nota"][data-c="negocio"][data-v="2"]');await J.click('.c1ppl figure:nth-child(1) [data-act="c1pitch"][data-v="4"]');await W(900);
// slides
await J.click('.c1info [data-act="c1view"]');await W(2500);
ok(await J.locator("#c1viewer canvas").count()===1,"leitor de slides mostra o PDF");
ok((await J.locator(".c1vc").textContent())==="1 / 3","página 1 de 3");
await J.keyboard.press("ArrowRight");await W(1200);
ok((await J.locator(".c1vc").textContent())==="2 / 3","seta → passa ao slide 2");
await J.click('[data-c1v="prev"]');await W(1200);
ok((await J.locator(".c1vc").textContent())==="1 / 3","botão ‹ volta ao slide 1");
await J.screenshot({path:"/tmp/qa-c1-viewer.png"});
await J.keyboard.press("Escape");await W(300);
ok(await J.locator("#c1viewer:not([hidden])").count()===0,"Esc fecha o leitor");
ok(await J.locator('.c1info a.fchip',{hasText:"MVP no Figma"}).count()===1,"link do MVP visível");
await J.evaluate(()=>window.scrollTo(0,0));await J.screenshot({path:"/tmp/qa-c1-apres.png",fullPage:true});
// re-render ao vivo não apaga o que se escreve
await J.fill(`#c1f-${orcId}`,"Texto a meio");await W(4500);
ok((await J.inputValue(`#c1f-${orcId}`))==="Texto a meio","texto mantém-se depois da atualização ao vivo");
// seguinte e notas
await J.locator('.c1eval [data-act="c1go"]').click();await W(300);
ok(!(await J.locator(".c1title").textContent()).startsWith("Orçamentação"),"«Seguinte» avança");
await J.click('[data-act="c1tab"][data-v="notas"]');await W(300);
ok(await J.locator(".c1tab tbody tr").count()===3,"As minhas notas: tabela com 3 ideias");
ok((await J.locator(".jtabs button",{hasText:"As minhas notas"}).textContent()).includes("1/3"),"contador 1/3 avaliadas");
await J.click('[data-act="c1tab"][data-v="todas"]');await W(300);
ok(await J.locator(".c1card").count()===3,"Todas as ideias: só as do Challenge I");
await J.fill("#c1qs","passaporte");await W(200);
ok(await J.locator(".c1card:not([hidden])").count()===1,"pesquisa filtra");
await J.fill("#c1qs","");await J.locator(".c1card",{hasText:"Orçamentação"}).locator("summary").click();await W(300);
ok(await J.locator(".c1card",{hasText:"Orçamentação"}).locator(".c1slbtn").count()===1,"Todas as ideias: slides dentro da ideia");
await W(4500);
ok(await J.locator('.c1card details[open]').count()===1,"detalhe aberto mantém-se após atualização");
await J.click('[data-act="c1fase"][data-v="ideacao"]');await W(300);
ok(await J.locator(".jtabs button",{hasText:"Avaliar par a par"}).count()===1,"botão para as sessões de ideação");
await J.click('[data-act="c1fase"][data-v=""]');await W(300);
ok((await J.locator(".jhero h1").textContent())==="Challenge I","voltar ao Challenge I");
// mobile
const Jm=await open("/juri",{code:JCODE,w:390,h:844,jurado:"Miguel Gomes"});
ok(await Jm.evaluate(()=>document.documentElement.scrollWidth<=390),"júri cabe em 390 px");
await Jm.screenshot({path:"/tmp/qa-c1-mobile.png",fullPage:true});
// 3. Coordenador vê resultados
await C.reload();await W(1500);await C.click('[data-go="hub"]');await W(300);await C.click('[data-tab="hub:c1"]');await W(500);
await C.click('[data-act="c1v"][data-v="res"]');await W(300);
const row=C.locator(".c1rrow",{hasText:"Orçamentação"});
ok((await row.textContent()).includes("3,7"),"resultados: média 3,7");
await row.click();await W(300);
ok(await C.locator(".c1det",{hasText:"Miguel Gomes"}).count()===1&&await C.locator(".c1det",{hasText:"Texto a meio"}).count()===1,"resultados: notas e feedback por jurado");
ok(await C.locator(".c1det",{hasText:"construtora"}).count()===1,"resultados: perguntas do jurado");
ok(await C.locator('[data-act="c1goRes"]').count()>=1,"cartão da ideia mostra a média do júri");
await C.screenshot({path:"/tmp/qa-c1-coord.png",fullPage:false});
const errs=C.errs.concat(J.errs,Jm.errs);
ok(errs.length===0,"sem erros JS",errs.join(" | "));
await b.close();console.log(fails?fails+" falhas":"tudo OK");process.exit(fails?1:0);
