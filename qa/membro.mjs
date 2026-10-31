// Testa /membro (Challenge I e modo admin) e os novos pedidos na vista de coordenador, com um Supabase simulado.
import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import path from "path";
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const CODE="codigo-teste-123";
const W=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m,x="")=>{if(!c)fails++;console.log((c?"OK   ":"FAIL ")+m,x);};
const MEM=[{nome:"Inês F.",email:"ines.fazenda@junitec.pt"},{nome:"Xavier S.",email:"xavier.silva@junitec.pt"},{nome:"Maria P.",email:"maria.pedro@junitec.pt"}];
const store=new Map();const put=(col,d)=>store.set(col+"/"+d.id,{col,id:d.id,data:d});
const I=(id,titulo,etapa,par,extra={})=>put("ideias",Object.assign({id,titulo,etapa,par,sessao:4,gosto:4,problema:"Problema de "+titulo,solucao:"Solução de "+titulo},extra));
I("c1a","Orçamentação","c1",["Guilherme D.","Xavier S."],{resumoJuri:"Problema real e validação muito bem feita. [Fundida: «Memória de Projeto»] Só um caso próximo."});
I("c1b","Assistente Inteligente de Saúde Pessoal","c1",["Inês F.","João F."],{resumoJuri:"Mercado gigante, mas APIs difíceis."});
I("c1c","Concursos Públicos","c1",["Maria P.","Xavier S."],{resumoJuri:"Há mercado, mas já existem várias."});
I("id1","Distrações Digitais","ideacao",["Inês F.","Lourenço S."],{sessao:1,resumoJuri:"Sem solução definida."});
I("id2","Filtrar Agua","ideacao",["Maria P.","João F."],{sessao:2,resumoS:{"2":"Resumo antigo por sessão."}});
put("feedback",{id:"f1",ideiaId:"c1b",jurado:"Ana Júri",veredito:"gosto",comentario:"Gostei muito do protótipo com dispositivos reais.",d:"2026-10-30"});
put("feedback",{id:"f2",ideiaId:"c1b",jurado:"Rui Júri",veredito:"mercado",comentario:"Validem quanto pagariam os utilizadores finais.",d:"2026-10-30"});
put("feedback",{id:"f3",ideiaId:"c1b",jurado:"Zé",comentario:"ok",d:"2026-10-30"}); // curto: escondido aos membros
put("fotos",{id:"main",fotos:{}});
const PUB=["ideias","sessoes","live","fotos","config","feedback"];
const tokEmail=t=>t&&t.startsWith("tok-")?t.slice(4):null;
const uploads=[];
function handle(route){
  const req=route.request(),u=new URL(req.url()),h=req.headers(),coord=h["x-inov-code"]===CODE,m=req.method();
  const em=tokEmail(String(h.authorization||"").replace("Bearer ",""));
  if(u.pathname.startsWith("/auth/v1/token")){const b=JSON.parse(req.postData()||"{}");const e=b.email||(b.refresh_token||"").slice(4);const mm=MEM.find(x=>x.email===e);
    if(!mm||(b.password&&b.password!=="senha-boa-1"))return route.fulfill({status:400,json:{error_description:"bad"}});
    return route.fulfill({json:{access_token:"tok-"+e,refresh_token:"ref-"+e,expires_in:3600,user:{email:e,user_metadata:{nome:mm.nome,must_change:false}}}});}
  if(u.pathname.startsWith("/auth/v1/"))return route.fulfill({json:{}});
  if(u.pathname.startsWith("/storage/v1/object/sign/"))return route.fulfill({json:{signedURL:"/object/sign/x?token=1"}});
  if(u.pathname.startsWith("/storage/v1/object/materiais/")){if(!em)return route.fulfill({status:403,body:"rls"});uploads.push(u.pathname);return route.fulfill({json:{Key:"x"}});}
  const p=u.pathname.replace("/rest/v1/","");
  if(p==="rpc/inov_coord")return route.fulfill({json:coord});
  if(p==="rpc/inov_nome"){const mm=MEM.find(x=>x.email===em);return route.fulfill({json:mm?mm.nome:null});}
  if(p.startsWith("membros"))return route.fulfill({json:coord?MEM:[]});
  const q=k=>{const v=u.searchParams.get(k);return v&&v.startsWith("eq.")?v.slice(3):null;};
  if(m==="GET"){const col=q("col"),id=q("id");const rows=[...store.values()].filter(r=>(!col||r.col===col)&&(!id||r.id===id)&&(coord||PUB.includes(r.col)||(em&&["sugestoes","materiais"].includes(r.col)&&r.data.email===em)));return route.fulfill({json:rows.map(r=>({id:r.id,col:r.col,data:r.data}))});}
  if(m==="POST"){let b=JSON.parse(req.postData());b=Array.isArray(b)?b:[b];
    if(b.some(r=>!(coord||["ideias","feedback"].includes(r.col)||(em&&["sugestoes","materiais"].includes(r.col)&&r.data.email===em))))return route.fulfill({status:403,body:"rls"});
    b.forEach(r=>store.set(r.col+"/"+r.id,{col:r.col,id:r.id,data:r.data}));return route.fulfill({status:201,body:""});}
  if(m==="DELETE"){store.delete(q("col")+"/"+q("id"));return route.fulfill({status:204,body:""});}
  return route.fulfill({status:400,body:"?"});
}
const b=await chromium.launch();
async function open(pathname,{code,w}={}){
  const c=await b.newContext({viewport:{width:w||1100,height:900}});
  await c.route(/fonts\.g/,r=>r.abort());await c.route(/supabase\.co/,handle);
  await c.route(/^http:\/\/inov\.test\//,r=>{const u=new URL(r.request().url());let f=u.pathname.startsWith("/membro")?"membro.html":u.pathname==="/"||u.pathname.startsWith("/juri")||u.pathname.startsWith("/coordenador")?"app.html":u.pathname.slice(1);return r.fulfill({path:ROOT+"/public/"+f,contentType:f.endsWith(".js")?"application/javascript":"text/html"});});
  const p=await c.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));p.on("dialog",d=>d.accept());
  if(code)await c.addInitScript(`localStorage.setItem("inov-coord-code",${JSON.stringify(code)})`);
  await p.goto("http://inov.test"+pathname);await W(900);return p;
}
const sug=()=>[...store.values()].filter(r=>r.col==="sugestoes").map(r=>r.data);
const file=(name)=>({name,mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 teste")});

// 1. Membro normal (Inês F.)
const M=await open("/membro",{w:390});
await M.fill("#em","ines.fazenda");await M.fill("#pw","senha-boa-1");await M.click("#lf button");await W(900);
ok(await M.locator('.tabs button[aria-pressed="true"]',{hasText:"Challenge I"}).count()===1,"abre no separador Challenge I");
ok(await M.locator("article .pill",{hasText:"Challenge I"}).count()===3,"mostra as 3 ideias do Challenge I");
await M.click('[data-a="c1f"][data-v="minhas"]');await W(200);
ok(await M.locator("article:has(.pill:has-text('Challenge I'))").count()===1,"filtro: só as minhas no Challenge I");
await M.click('[data-a="c1f"][data-v="todas"]');await W(200);
const res=M.locator('#i-c1b [data-a="fbt"]');
ok((await res.textContent()).includes("Mercado gigante"),"resumo do feedback no cartão");
ok((await res.textContent()).includes("(2)"),"conta só os feedbacks visíveis (2)");
await res.click();await W(200);
ok(await M.locator("#i-c1b .fbl .fb").count()===2,"clicar no resumo mostra todos os feedbacks visíveis");
ok((await M.locator('#i-c1a [data-a="fbt"]').innerHTML()).includes("Da ideia juntada «Memória de Projeto»"),"resumo de ideias fundidas formatado");
// colaborar
await M.click('#i-c1a [data-a="pan"][data-k="col"]');await W(200);
await M.click('#i-c1a [data-a="col"]');await W(200);
ok(await M.locator(".msg.err").count()===1,"colaborar exige justificação");
await M.fill("#cj-c1a","Conheço três gabinetes de arquitetura.");await M.click('#i-c1a [data-a="col"]');await W(500);
ok(sug().some(s=>s.tipo==="colaborar"&&s.ideiaId==="c1a"&&s.email==="ines.fazenda@junitec.pt"),"pedido para colaborar gravado");
ok(await M.locator("#i-c1a",{hasText:"Pedido para colaborar enviado"}).count()===1,"cartão mostra pedido enviado");
// propor alteração com título
await M.click('#i-c1b [data-a="pan"][data-k="alt"]');await W(200);
await M.fill("#at-c1b","Saúde pessoal com wearables");await M.fill("#p-c1b","Problema novo");await M.click('#i-c1b [data-a="sug"]');await W(500);
ok(sug().some(s=>s.tipo==="descricao"&&s.tituloNovo==="Saúde pessoal com wearables"&&s.problema==="Problema novo"),"proposta de título e descrição gravada");
// matar com ficheiro
await M.click('#i-c1b [data-a="pan"][data-k="matar"]');await W(200);
await M.fill("#mj-c1b","10 entrevistas: ninguém pagaria.");await M.setInputFiles("#mk-f-c1b",file("entrevistas.pdf"));await M.click('#i-c1b [data-a="matar"]');await W(700);
const mk=sug().find(s=>s.tipo==="matar");
ok(mk&&mk.ficheiros.length===1&&mk.ficheiros[0].ficheiro==="entrevistas.pdf","pedido para matar gravado com ficheiro");
ok(uploads.length===1&&[...store.values()].some(r=>r.col==="materiais"&&r.data.ficheiro==="entrevistas.pdf"),"ficheiro subiu ao Storage e ficou nos materiais");
// repescagem
await M.click('#i-id1 [data-a="pan"][data-k="rep"]');await W(200);
await M.fill("#rj-id1","Validámos com 8 empresas.");await M.click('#i-id1 [data-a="rep"]');await W(300);
ok(await M.locator(".msg.err",{hasText:"pelo menos um ficheiro"}).count()===1,"pedido para passar exige ficheiro de validação");
await M.fill("#rj-id1","Validámos com 8 empresas.");await M.setInputFiles("#rk-f-id1",[file("inquerito.pdf"),file("entrevistas2.pdf")]);await M.click('#i-id1 [data-a="rep"]');await W(800);
const rp=sug().find(s=>s.tipo==="repescagem");
ok(rp&&rp.ideiaId==="id1"&&rp.ficheiros.length===2,"pedido para passar ao Challenge I gravado com 2 ficheiros");
ok(await M.evaluate(()=>document.documentElement.scrollWidth<=390),"cabe em 390 px");
await M.click('#i-c1a [data-a="fbt"]');await M.click('#i-c1c [data-a="pan"][data-k="col"]');await W(300);await M.evaluate(()=>window.scrollTo(0,0));await M.screenshot({path:"/tmp/qa-membro-c1.png",fullPage:true});
await M.click('[data-a="tab"][data-t="todas"]');await W(200);
ok((await M.locator('#i-id2 [data-a="fbt"]').textContent()).includes("Resumo antigo por sessão"),"sem resumoJuri usa o resumo por sessão");
await M.screenshot({path:"/tmp/qa-membro-todas.png",fullPage:false});

// 2. Modo admin
const nBefore=sug().length;
const A=await open("/membro?admin",{code:CODE});
ok(await A.locator(".pick button").count()===3,"modo admin: escolher membro");
await A.click('[data-a="admpick"][data-e="xavier.silva@junitec.pt"]');await W(900);
ok(await A.locator(".adm").count()===1&&(await A.locator(".bar b").textContent())==="Xavier S.","vê a área como Xavier S.");
ok(await A.locator("article:has(.pill:has-text('Tua ideia'))").count()===2,"vê as ideias do Xavier como suas");
await A.click('#i-c1b [data-a="pan"][data-k="col"]');await W(200);await A.fill("#cj-c1b","Teste admin");await A.click('#i-c1b [data-a="col"]');await W(400);
ok(sug().length===nBefore&&(await A.locator(".msg",{hasText:"simulação"}).count())===1,"simulação: nada gravado");
ok(await A.locator("#i-c1b",{hasText:"Pedido para colaborar enviado"}).count()===1,"simulação: ecrã reage como para o membro");
await A.screenshot({path:"/tmp/qa-admin.png"});
await A.uncheck("#admsim");await W(200);
await A.click('#i-c1a [data-a="pan"][data-k="alt"]');await W(200);await A.fill("#p-c1a","Problema via admin");await A.click('#i-c1a [data-a="sug"]');await W(500);
const t=sug().find(s=>s.problema==="Problema via admin");
ok(t&&t.teste===true&&t.email==="xavier.silva@junitec.pt","sem simulação: grava como o membro, marcado teste");
await A.selectOption("#admsel","maria.pedro@junitec.pt");await W(900);
ok((await A.locator(".bar b").textContent())==="Maria P.","trocar de membro na barra");
await A.reload();await W(1200);
ok((await A.locator(".bar b").textContent())==="Maria P.","recarregar mantém o membro escolhido");
await A.click('[data-a="admexit"]');await W(500);
ok(await A.locator("#lf").count()===1,"sair do modo admin volta ao login");
const A2=await open("/membro?admin");
ok(await A2.locator("#acode").count()===1,"sem código pede o código de coordenador");
await A2.fill("#acode","errado");await A2.click("#acf button.pri");await W(400);
ok(await A2.locator(".msg.err").count()===1,"código errado recusado");

// 3. Coordenador decide
const C=await open("/coordenador",{code:CODE});await W(1500);
await C.click('[data-go="hub"]');await W(400);await C.click('[data-tab="hub:sug"]');await W(600);
ok(await C.locator(".sgcard",{hasText:"pede para colaborar (Challenge I) em"}).count()>=1,"coordenador vê pedido para colaborar");
ok(await C.locator(".sgcard",{hasText:"pede para passar ao Challenge I"}).count()===1,"coordenador vê pedido para passar ao Challenge I");
ok(await C.locator(".sgcard",{hasText:"teste (modo admin)"}).count()>=1,"pedido do modo admin marcado teste");
const card=C.locator(".sgcard",{hasText:"pede para passar ao Challenge I"});
ok(await card.locator('[data-act="matopen"]').count()===2,"ficheiros de validação visíveis");
await card.locator('[data-act="sugok"]').click();await W(1200);
ok(store.get("ideias/id1").data.etapa==="c1","aceitar passa a ideia ao Challenge I");
await C.locator(".sgcard",{hasText:"pede para matar"}).locator('[data-act="sugok"]').click();await W(1200);
ok(store.get("ideias/c1b").data.etapa==="ideacao"&&store.get("ideias/c1b").data.morta,"aceitar matar tira a ideia do Challenge I");
await C.locator(".sgcard",{hasText:"Saúde pessoal com wearables"}).locator('[data-act="sugok"]').click();await W(1200);
const c1b=store.get("ideias/c1b").data;
ok(c1b.titulo==="Saúde pessoal com wearables"&&c1b.historico&&c1b.historico[0].titulo==="Assistente Inteligente de Saúde Pessoal","aceitar alteração muda o título e guarda o antigo");
await C.locator(".sgcard",{hasText:"Conheço três gabinetes"}).locator('[data-act="sugok"]').click();await W(1200);
ok(store.get("ideias/c1a").data.par.includes("Inês F."),"aceitar colaborar junta a pessoa à ideia");
await C.screenshot({path:"/tmp/qa-coord.png",fullPage:true});
const errs=M.errs.concat(A.errs,A2.errs,C.errs);
ok(errs.length===0,"sem erros JS",errs.join("|"));
await b.close();console.log(fails?fails+" falhas":"tudo OK");process.exit(fails?1:0);
