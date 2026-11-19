// Testa o separador Challenge II de /membro: resumo, notas médias e feedback de cada jurado, com um Supabase simulado.
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

I("c2a","Registo de Manutenção","c2",["Matilde S.","Lourenço S."],{resumoS:{c1:"Resumo do Challenge I da manutenção.",c2:"Apresentação: história clara.\nIdeia: definam como obter os manuais."}});
I("c2b","Notas de alta","c2",["Rita M.","Francisca O."],{resumoS:{c2:"Ideia: falem com mais médicos."}});
const av=(id,ideia,jur,notas,fb,extra={})=>put("feedback",Object.assign({id,tipo:"c2aval",fase:"c2",ideiaId:ideia,jurado:jur,notas,feedback:fb,perguntas:"",enviadoEm:"2026-11-16T18:00:00Z"},extra));
av("c2__c2a__a","c2a","Jurado A",{problema:4,validacao:3,solucao:5,viabilidade:2,escalabilidade:4},"Validem com uma fábrica real.");
av("c2__c2a__b","c2a","Jurado B",{problema:5,validacao:3,solucao:3,viabilidade:3,escalabilidade:3},"");
av("c2__c2a__c","c2a","Jurado C",{problema:3,validacao:3,solucao:3,viabilidade:3,escalabilidade:3},"Texto escondido",{ocultoMembros:true});

const P=await open("/membro",{w:390});
await P.fill("#em","ines.fazenda");await P.fill("#pw","senha-boa-1");await P.click("#lf button");await W(900);
ok(await P.locator('.tabs button[aria-pressed="true"]',{hasText:"Challenge II"}).count()===1,"abre no separador Challenge II");
ok(await P.locator("article .pill",{hasText:"Challenge II"}).count()===2,"mostra todas as ideias do Challenge II (também as de outros)");
const r2=P.locator('#i-c2a [data-a="c2t"]');
ok((await r2.textContent()).includes("definam como obter os manuais"),"resumo do Challenge II no cartão");
ok((await P.locator("#i-c2a").textContent()).includes("Resumo do Challenge I da manutenção"),"resumo do Challenge I continua no cartão");
ok(await P.locator("#i-c2a .fbl").count()===0,"detalhe fechado por omissão");
await r2.click();await W(200);
ok(await P.locator("#i-c2a .fbl .fb").count()===1,"abre só o feedback visível (o escondido não aparece)");
const t=await P.locator("#i-c2a").textContent();
ok(t.includes("Validem com uma fábrica real")&&!t.includes("Texto escondido"),"feedback do jurado visível e o escondido fora");
ok(t.includes("4,0"),"nota média do critério Problema (4,0)");
ok((await P.locator('#i-c2b [data-a="c2t"]').textContent()).includes("falem com mais médicos"),"resumo de outra ideia visível");
ok(P.errs.length===0,"sem erros JS",P.errs.join("|"));
await b.close();
console.log(fails?"FALHOU "+fails:"TUDO OK");process.exit(fails?1:0);
