// Testa o painel do júri do Challenge II (agenda, speakers, sem Business model, chat do júri, acesso só ao Challenge II), com um Supabase simulado.
// Corre: node qa/juri_c2.mjs
import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "path";
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const CODE="codigo-teste-123",JCODE="1fh73r",PDFJS="/tmp/pdfjs4/package/build/";
const W=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m,x="")=>{if(!c)fails++;console.log((c?"OK   ":"FAIL ")+m,x);};
const store=new Map();const put=(col,d)=>store.set(col+"/"+d.id,{col,id:d.id,data:d});
const I=(id,titulo,par,extra={})=>put("ideias",Object.assign({id,titulo,etapa:"c2",par,sessao:4,gosto:4,problema:"Problema de "+titulo,solucao:"Solução de "+titulo},extra));
I("g1","Gestão desportiva",["Bernardo F.","João F."]);
I("g2","Engenharia civil",["Inês P.","Guilherme D.","Maria P.","Xavier S."]);
I("g3","Notas de alta",["Rita M.","Francisca O."]);
I("c1x","Acessibilidade (só Challenge I)",["Matilde S.","Afonso M."],{etapa:"c1"});
I("z9","Ideia de ideação",["Inês F."],{etapa:"ideacao"});
put("config",{id:"main",juriFase:"c2",fases:{
  c1:{nome:"Challenge I",data:"2026-11-03",min:0,max:10,juri:[],ordem:["c1x","g3"]},
  c2:{nome:"Challenge II",data:"2026-11-18",min:0,max:10,juri:[],ordem:["g1","g2","g3"],pausaApos:2,inicio:"18h00",sala:"VA4",
    ag:{g1:{p:"Clubes perdem material",s:"plataforma B2B de gestão",eq:"Bernardo + João"},g2:{p:"Projetistas perdem horas",s:"software que gera memórias",eq:"Inês P. + Guilherme + Maria + Xavier",sp:["Inês P."]},g3:{p:"Notas de alta demoram",s:"plataforma que propõe rascunho",eq:"Rita + Francisca",sp:["Rita M.","Francisca O."]}}},
  sd:{nome:"Selection Day",data:"2026-11-27",min:0,max:10,juri:[]}}});
// avaliação do Challenge I já existente (não pode ser tocada pelo Challenge II)
const C1DOC={id:"c1__g3__miguel-gomes",tipo:"c1aval",fase:"c1",ideiaId:"g3",jurado:"Miguel Gomes",notas:{problema:5,negocio:2},pitch:{"Rita M.":4},perguntas:"Pergunta do Challenge I",feedback:"Feedback do Challenge I",enviadoEm:"2026-11-03T19:00:00Z"};
put("feedback",C1DOC);
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
const doc=id=>(store.get("feedback/"+id)||{}).data;
// 1. Júri A: só Challenge II
const A=await open("/juri",{code:JCODE});
await A.click('[data-act="jset"][data-v="Miguel Gomes"]');await W(600);
ok((await A.locator(".jhero h1").textContent())==="Challenge II","júri abre no Challenge II");
ok(await A.locator(".c1bar .pairchip").count()===3,"barra só com as 3 ideias do Challenge II");
ok((await A.locator(".c1bar .pairchip").allTextContents()).join("|").includes("Gestão")&&!(await A.locator(".c1bar").textContent()).includes("Acessibilidade"),"ideias do Challenge I e da ideação não aparecem");
ok((await A.locator(".c1bar .pairchip b.c1n").allTextContents()).join()==="1,2,3","ordem da agenda");
ok(await A.locator('[data-act="c1fase"]').count()===0,"júri sem botão das sessões de ideação");
ok(await A.locator(".jtabs button",{hasText:"Avaliar par a par"}).count()===0,"júri sem vista das sessões");
// 2. Agenda
await A.click('[data-act="c1tab"][data-v="agenda"]');await W(300);
ok((await A.locator(".card-h h2").textContent())==="AGENDA CHALLENGE II - Início 18h00 VA4","título da agenda");
ok(await A.locator(".c2ag tbody tr:not(.c2brk)").count()===3&&await A.locator(".c2ag tr.c2brk").count()===1,"3 apresentações e 1 intervalo");
ok((await A.locator(".c2ag tbody tr").nth(2).textContent()).includes("COFFEE BREAK"),"intervalo depois da 2.ª");
const ag=await A.locator(".c2ag tbody tr:not(.c2brk)").allTextContents();
ok(ag[0].includes("Toda a equipa")&&ag[1].includes("Inês P.")&&!ag[1].includes("Toda")&&ag[2].includes("Rita M. e Francisca O."),"speakers (em branco = toda a equipa)",ag.map(x=>x.slice(-30)).join(" | "));
await A.locator(".c2ag tbody tr:not(.c2brk)").nth(1).click();await W(400);
ok((await A.locator(".c1title").textContent())==="Engenharia civil","clicar na linha abre a ideia");
// 3. Avaliação: sem Business model; pitch só nos speakers
ok(await A.locator('[data-c="negocio"]').count()===0&&await A.locator(".c1crit .c1row").count()===5,"5 critérios, sem Business model");
ok(await A.locator(".c1ppl figure").count()===1&&(await A.locator(".c1ppl figcaption").textContent())==="Inês P.","pitch só no speaker (Inês P.)");
ok((await A.locator(".c1ppl + p, .c1info p.note").allTextContents()).join().includes("Equipa: Inês P., Guilherme D., Maria P., Xavier S."),"mostra a equipa completa");
const before=JSON.stringify(doc("c1__g3__miguel-gomes"));
for(const [c,v] of [["problema",4],["validacao",3],["solucao",4],["escalabilidade",3],["viabilidade",5]]){await A.click(`[data-act="c1nota"][data-c="${c}"][data-v="${v}"]`);await W(120);}
await A.click('.c1ppl [data-act="c1pitch"][data-v="4"]');await W(900);
ok((await A.locator(".c1avg b").textContent())==="3,8","média ao vivo com 5 critérios (3,8)");
const d2=doc("c2__g2__miguel-gomes");
ok(d2&&d2.tipo==="c2aval"&&d2.fase==="c2"&&d2.notas.viabilidade===5&&d2.pitch["Inês P."]===4&&d2.notas.negocio===undefined,"avaliação gravada como c2aval");
ok(!doc("c1__g2__miguel-gomes"),"nada gravado como Challenge I");
ok(JSON.stringify(doc("c1__g3__miguel-gomes"))===before,"documento do Challenge I intacto");
// notas
await A.click('[data-act="c1tab"][data-v="notas"]');await W(300);
ok((await A.locator(".c1tab thead th").allTextContents()).join().indexOf("BM")<0&&await A.locator(".c1tab tbody tr").count()===3,"As minhas notas: 3 ideias, sem BM");
ok((await A.locator(".jtabs button",{hasText:"As minhas notas"}).textContent()).includes("1/3"),"contador 1/3");
// 4. Chat: A escreve, B vê
await A.click('[data-act="c1tab"][data-v="apres"]');await W(300);
await A.fill("#c2m-g2-f","Validem o preço com uma gabinete real");await A.press("#c2m-g2-f","Enter");await W(900);
const m1=doc("c2__g2__miguel-gomes");
ok(m1.msgs&&m1.msgs.length===1&&m1.msgs[0].k==="f"&&m1.feedback.includes("gabinete")&&m1.perguntas==="","mensagem gravada e espelhada em feedback");
ok((await A.locator(".c2chat .fbul li").count())===1&&(await A.inputValue("#c2m-g2-f"))==="","A vê a mensagem e a caixa fica vazia");
const B=await open("/juri",{code:JCODE,jurado:"Gabriela Gomes"});
await B.click('[data-act="c1go"][data-id="g2"]');await W(500);
ok((await B.locator(".c2chat .fbul").textContent()).includes("Miguel Gomes")&&(await B.locator(".c2chat .fbul").textContent()).includes("gabinete"),"júri B vê o feedback do júri A");
ok(await B.locator('.c2chat [data-act="c2del"]').count()===0,"B não pode apagar a mensagem do A");
await B.locator(".c2chat .jc-q summary").click();await B.fill("#c2m-g2-q","Quantos gabinetes já testaram?");await B.click('[data-act="c2send"][data-k="q"]');await W(900);
const mb=doc("c2__g2__gabriela-gomes");
ok(mb&&mb.msgs.length===1&&mb.msgs[0].k==="q"&&mb.perguntas.includes("gabinetes"),"B envia uma pergunta");
await W(5500);
const txtA=await A.locator(".c2chat .fbul").textContent();
ok(txtA.includes("Gabriela Gomes")&&txtA.includes("gabinetes")&&txtA.includes("Pergunta"),"júri A vê a pergunta do B ao vivo");
// escrever a meio não se perde com a atualização ao vivo
await A.fill("#c2m-g2-f","a meio do texto");await W(5000);
ok((await A.inputValue("#c2m-g2-f"))==="a meio do texto","texto a meio mantém-se após atualização");
await A.fill("#c2m-g2-f","");
await A.click('.c2chat [data-act="c2del"]');await W(900);
ok(doc("c2__g2__miguel-gomes").msgs.length===0&&doc("c2__g2__miguel-gomes").feedback==="","A apaga a sua mensagem");
ok(await A.evaluate(()=>document.documentElement.scrollWidth<=1280),"sem scroll horizontal");
await A.screenshot({path:"/tmp/qa-c2-apres.png",fullPage:true});
// 5. Telemóvel
const M=await open("/juri",{code:JCODE,w:390,h:844,jurado:"Miguel Gomes"});
await M.click('[data-act="c1tab"][data-v="agenda"]');await W(300);
ok(await M.evaluate(()=>document.documentElement.scrollWidth<=390),"agenda cabe em 390 px");
await M.screenshot({path:"/tmp/qa-c2-mobile.png",fullPage:true});
// 6. Coordenador
const C=await open("/coordenador",{code:CODE});
await C.click('[data-go="hub"]');await W(300);await C.click('[data-tab="hub:c2"]');await W(600);
ok(await C.locator("h2",{hasText:"Apresentações e avaliação do júri"}).count()===1,"coordenador: cartão no Challenge II");
ok((await C.locator(".c1ord .c1ot b").allTextContents()).join("|")==="Gestão desportiva|Engenharia civil|Notas de alta","ordem do Challenge II (só as 3)");
ok(await C.locator('.c1ord [data-act="c2spk"]').count()===8,"botões de speaker por pessoa");
await C.locator('.c1ord li').nth(0).locator('[data-act="c2spk"]',{hasText:"Bernardo F."}).click();await W(700);
ok(JSON.stringify(cfg().fases.c2.ag.g1.sp)==='["Bernardo F."]',"speaker gravado em config");
ok(await C.locator('.seg [data-act="c1jf"]').count()===3,"coordenador escolhe o que o painel do júri mostra (3 opções)");
await C.click('[data-act="c1v"][data-v="res"]');await W(300);
const row=C.locator(".c1rrow",{hasText:"Engenharia civil"});
ok((await row.textContent()).includes("3,8"),"resultados do Challenge II: média 3,8");
await C.click('[data-act="c1ropen"][data-id="g2"]');await W(300);
ok(await C.locator(".c1det",{hasText:"Gabriela Gomes"}).count()===1&&await C.locator(".c1det",{hasText:"gabinetes"}).count()===1,"resultados mostram o que cada jurado escreveu");
// Challenge I continua separado no coordenador
await C.click('[data-tab="hub:c1"]');await W(500);await C.click('[data-act="c1v"][data-v="ordem"]');await W(300);
ok((await C.locator(".c1ord .c1ot b").allTextContents()).slice(0,2).join("|")==="Acessibilidade (só Challenge I)|Notas de alta"&&(await C.locator(".c1ord .c1ot b").count())===4,"Challenge I mantém a sua ordem (e continua a listar as 4 ideias que passaram por ele)");
await C.click('[data-act="c1v"][data-v="res"]');await W(300);
ok((await C.locator(".c1rrow",{hasText:"Notas de alta"}).textContent()).includes("Júris")===false&&(await C.locator(".c1rrow",{hasText:"Notas de alta"}).locator("td").nth(2).textContent())==="1","Challenge I: só a avaliação do Challenge I (1 jurado)");
// painel do júri passa a Challenge I
await C.click('[data-act="c1jf"][data-v="c1"]');await W(700);
ok(cfg().juriFase==="c1","coordenador muda o painel para o Challenge I");
await A.reload();await W(1500);
ok((await A.locator(".jhero h1").textContent())==="Challenge I"&&await A.locator(".c1bar .pairchip").count()===4,"júri vê o Challenge I quando o coordenador o escolhe");
ok(await A.locator('.jtabs [data-v="agenda"]').count()===0&&await A.locator(".c1crit .c1row").count()===6&&await A.locator(".c1chat, .c2chat").count()===0,"Challenge I: sem Agenda e sem chat, e com Business model");
const all=[A,B,M,C];const errs=all.flatMap(p=>p.errs);ok(errs.length===0,"sem erros de JavaScript",errs.join(" | "));
await b.close();console.log(fails?`\n${fails} FALHAS`:"\nTUDO OK");process.exit(fails?1:0);
