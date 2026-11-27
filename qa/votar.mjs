import {chromium} from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";import fs from "fs";
const store=new Map();let fails=0;const ok=(c,m,x)=>{console.log((c?"OK   ":"FAIL ")+m,c?"":x||"");if(!c)fails++;};
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
const html=fs.readFileSync("public/votar.html","utf8");
await c.route("**/*",r=>{const u=new URL(r.request().url()),m=r.request().method();
  if(u.hostname==="inov.test"&&u.pathname==="/votar")return r.fulfill({contentType:"text/html",body:html});
  if(u.hostname==="inov.test")return r.fulfill({status:200,contentType:"image/png",body:Buffer.alloc(0)});
  if(u.pathname.endsWith("/rpc/votos_resultado")){const pw=JSON.parse(r.request().postData()).p;if(pw!=="batatafrita")return r.fulfill({status:400,body:'{"message":"pass"}'});const n={};[...store.values()].forEach(v=>n[v.ideia]=(n[v.ideia]||0)+1);return r.fulfill({json:Object.entries(n).map(([ideia,n])=>({ideia,n})).sort((a,b)=>b.n-a.n)});}
  if(u.pathname.endsWith("/rest/v1/docs")&&m==="POST"){const b=JSON.parse(r.request().postData());if(b.col!=="pedidos")return r.fulfill({status:403,body:"rls"});if(store.has(b.id))return r.fulfill({status:409,body:'{"code":"23505"}'});store.set(b.id,b.data);return r.fulfill({status:201,body:""});}
  return r.fulfill({status:404,body:""});});
await p.goto("http://inov.test/votar");
ok(await p.locator(".opt").count()===8,"8 ideias para votar");
ok(await p.locator("#go").isDisabled(),"votar desligado sem nome e escolha");
await p.fill("#n","Ana Silva");await p.click('.opt[data-id="kblmh7rcmb"]');
ok(!(await p.locator("#go").isDisabled()),"votar ligado com nome e escolha");
await p.click("#go");await p.waitForTimeout(300);
ok(store.size===1&&[...store.keys()][0]==="voto__ana-silva","voto gravado em pedidos com id voto__ana-silva");
ok((await p.locator(".done").textContent()).includes("SquadDock"),"mostra agradecimento com a ideia");
ok(await p.locator(".opt").count()===0,"depois de votar já não mostra as opções");
await p.fill("#pw","errada");await p.click("#rv");await p.waitForTimeout(300);
ok((await p.locator(".msg.e").textContent()).includes("errada"),"palavra-passe errada recusada");
await p.fill("#pw","batatafrita");await p.click("#rv");await p.waitForTimeout(300);
ok((await p.locator(".bars").textContent()).includes("SquadDock")&&(await p.locator(".bar.w").textContent()).includes("SquadDock"),"resultados com a palavra-passe certa");
// segundo dispositivo, mesmo nome
const c2=await b.newContext({viewport:{width:390,height:844}});await c2.route("**/*",async r=>{const u=new URL(r.request().url());if(u.hostname==="inov.test"&&u.pathname==="/votar")return r.fulfill({contentType:"text/html",body:html});if(u.hostname==="inov.test")return r.fulfill({status:200,body:""});if(r.request().method()==="POST"&&u.pathname.endsWith("/docs")){const b=JSON.parse(r.request().postData());if(store.has(b.id))return r.fulfill({status:409,body:"{}"});}return r.fulfill({status:404,body:""});});
const q=await c2.newPage();await q.goto("http://inov.test/votar");await q.fill("#n","ana  SILVA");await q.click('.opt[data-id="mlvo1t7vddgl"]');await q.click("#go");await q.waitForTimeout(300);
ok((await q.locator(".msg.e").textContent()).includes("já votou"),"mesmo nome não vota duas vezes");
ok(errs.length===0,"sem erros JS",errs.join("|"));
await b.close();console.log(fails?"FALHOU "+fails:"TUDO OK");process.exit(fails?1:0);
