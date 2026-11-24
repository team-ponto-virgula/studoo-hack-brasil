// Gera pranchas e PDFs a partir das capturas do renderer, sem alterar imagens.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=__dirname,qaArg=process.argv.indexOf('--qa-dir');
if(qaArg<0||!process.argv[qaArg+1])throw new Error('Informe --qa-dir da rodada final revisada.');
const qa=path.resolve(process.argv[qaArg+1]);
const qaMatrix=JSON.parse(fs.readFileSync(path.join(qa,'matriz.json'),'utf8'));
const sourceCandidate=qaMatrix.metadata?.commit;
if(!/^[a-f0-9]{40}$/.test(sourceCandidate||'')||qaMatrix.metadata.sourceStable!==true)throw new Error('Capturas sem commit completo e fonte estável.');
const sourceLabel=sourceCandidate.slice(0,7);
const port=process.env.STUDOO_DESIGN_PORT||'3012';
const base=`http://localhost:${port}/docs/ux/direcoes-2026-11-24/`;
const out=path.join(root,'evidencias','final'),delivery=path.join(root,'entrega');
fs.mkdirSync(out,{recursive:true});
const styles={jornada:{letter:'a',title:'Jornada Azul',summary:'Progressão visível, feedback próximo e um passo por vez.'},caderno:{letter:'b',title:'Caderno Claro',summary:'Capítulos, papel e marcadores para construir entendimento.'},foco:{letter:'c',title:'Foco Vivo',summary:'Conceito central, leitura calma e próxima ação evidente.'}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [file,expected]of Object.entries(qaMatrix.metadata.hashesAfter||{})){
 if(hash(path.join(root,'prototipo',file))!==expected)throw new Error('Fonte diferente da candidata capturada: '+file);
}
const manifest={createdAt:new Date().toISOString(),sourceCandidate,sourceFiles:qaMatrix.metadata.hashesAfter,qaDirectory:path.basename(qa),nativeExecution:false,images:[],pdfs:[],panels:[],htmlBundles:[],scope:'Pranchas visuais das dobras iniciais; conteúdo rolável e interações no protótipo.'};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844}});
  await p.goto(base+'prototipo/app.html?d=jornada&p=inicio');
  const pages=await p.evaluate(()=>window.STUDOO_PAGES);
  for(const [direction,style]of Object.entries(styles)){
   for(const key of Object.keys(pages))for(const width of [390,360]){
    const name=`${direction}-${key}-${width}.png`,existing=path.join(qa,name);
    if(!fs.existsSync(existing))throw new Error('Captura de QA ausente: '+name+'; informe --qa-dir da rodada final.');
    const row=qaMatrix.rows.find(r=>r.dir===direction&&r.page===key&&r.w===width);
    if(!row||row.errors?.length)throw new Error('Captura sem linha de QA aprovada: '+name);
    const png=fs.readFileSync(existing);
    if(png.readUInt32BE(16)!==width*2||png.readUInt32BE(20)!==(width===390?844:800)*2)throw new Error('Captura não corresponde ao viewport DPR2: '+name);
    const dest=path.join(out,name);fs.copyFileSync(existing,dest);
    manifest.images.push({file:path.relative(root,dest),page:key,direction,width,height:width===390?844:800,sha256:hash(dest)});
   }
   const frameKeys=Object.keys(pages);
   const cover=`<section class="pdf-cover"><img src="${base}prototipo/assets/logo.png" alt="Studoo"><div class="letter">${style.letter.toUpperCase()}</div><h1>${style.title}</h1><p>${style.summary}</p><div class="cover-note">35 páginas principais · proposta mobile<br>Fonte: candidata ${sourceLabel} · dados sintéticos</div><a class="cover-link" href="https://github.com/team-ponto-virgula/studoo-hack-brasil/tree/feat/mobile-direcoes-design/docs/ux/direcoes-2026-11-24">Índice, critérios e referências</a><p class="limits">Estas são capturas da dobra inicial em 390×844. O protótipo contém rolagem, interações e estados adicionais. O personagem do kit atual é provisório; não representa a integração final do Stu caderno. Nenhuma execução nativa é alegada.</p></section>`;
   const sheets=frameKeys.map((key,i)=>`<section class="pdf-page"><header><strong>${i+1}. ${esc(pages[key])}</strong><span>${style.letter.toUpperCase()} · ${style.title}</span></header><img class="screen-shot" src="${base}evidencias/final/${direction}-${key}-390.png" alt="Proposta de ${esc(pages[key])}, ${style.title}, em 390 por 844"><footer>Protótipo · dados de exemplo · sem serviços reais</footer></section>`).join('');
   const book=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Studoo · ${esc(style.title)} · proposta mobile</title><style>@font-face{font-family:Nunito;src:url(${base}prototipo/assets/nunito.woff2);font-weight:200 1000}@font-face{font-family:Quicksand;src:url(${base}prototipo/assets/quicksand.woff2);font-weight:300 700}*{box-sizing:border-box}body{margin:0;font:14px/1.5 Nunito,sans-serif;color:#142453;background:#fff}.pdf-cover{height:900px;padding:56px 32px;display:flex;flex-direction:column;gap:24px}.pdf-cover>img{width:120px}.letter{font:bold 60px Quicksand;color:#2457dd;margin-top:60px}.pdf-cover h1{font:700 38px/1.15 Quicksand;letter-spacing:-.03em;margin:0}.pdf-cover p{margin:0;font-size:18px}.cover-link{font-size:13px;color:#2457dd;font-weight:800}.cover-note{margin-top:30px;font-weight:800;color:#2457dd}.pdf-cover .limits{font-size:13px;color:#52617d;margin-top:auto}.pdf-page{break-before:page;width:430px;height:940px;padding:16px 20px 8px}header{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;height:36px}header span{color:#52617d}header strong{font-size:13px}.screen-shot{display:block;width:390px;height:844px;object-fit:contain}footer{font-size:10px;color:#52617d;text-align:center;margin-top:12px}@page{size:430px 940px;margin:0}</style></head><body>${cover}${sheets}</body></html>`;
   await p.setViewportSize({width:430,height:940});await p.setContent(book,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
   if(!await p.evaluate(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0)))throw new Error('PDF contém imagem que não carregou: '+direction);
   const file=`studoo-direcao-${style.letter}.pdf`,dest=path.join(delivery,file);await p.pdf({path:dest,width:'430px',height:'940px',printBackground:true,preferCSSPageSize:true,tagged:true});
   manifest.pdfs.push({file:'entrega/'+file,sha256:hash(dest),frames:frameKeys.length,scope:'Dobra inicial; use o protótipo para rolar/interagir.'});
  }
  const common=`@font-face{font-family:Nunito;src:url(${base}prototipo/assets/nunito.woff2);font-weight:200 1000}@font-face{font-family:Quicksand;src:url(${base}prototipo/assets/quicksand.woff2);font-weight:300 700}*{box-sizing:border-box}body{margin:0;padding:32px;background:#f0f4fb;color:#142453;font-family:Nunito,sans-serif}h1{font:700 32px/1.2 Quicksand;margin:10px 0 8px;letter-spacing:-.035em}p{margin:0;color:#52617d}header{margin-bottom:28px}header img{width:104px}.frames{display:grid;grid-template-columns:repeat(3,390px);gap:24px}figure{margin:0}figcaption{font-weight:900;font-size:16px;margin-bottom:10px;display:flex;justify-content:space-between;gap:12px}figcaption span{font-size:13px;font-weight:700;color:#52617d}figure img{display:block;width:390px;height:844px;border-radius:18px;border:1px solid #d9e2f1}.caption{font-size:13px;margin-top:24px;max-width:1170px}`;
  const panel=async(file,title,lead,frames)=>{
   const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${common}</style></head><body><header><img src="${base}prototipo/assets/logo.png" alt="Studoo"><h1>${title}</h1><p>${lead}</p></header><div class="frames">${frames.map(({d,k})=>`<figure><figcaption>${esc(pages[k])}<span>${styles[d].letter.toUpperCase()} · ${styles[d].title}</span></figcaption><img src="${base}evidencias/final/${d}-${k}-390.png" alt="${esc(pages[k])}, ${styles[d].title}"></figure>`).join('')}</div><p class="caption">Propostas de interface mobile · capturas do protótipo com dados sintéticos · não são gravações iOS/Android. Kit de personagem atual provisório. Fonte ${sourceLabel}; resultados e escopo da avaliação no repositório.</p></body></html>`;
   const hp=path.join(out,file.replace('.png','.html'));fs.writeFileSync(hp,html);
   await p.setViewportSize({width:1282,height:1000});await p.setContent(html,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
   if(!await p.evaluate(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0)))throw new Error('Prancha contém imagem que não carregou: '+file);
   const dest=path.join(out,file);await p.screenshot({path:dest,fullPage:true});manifest.panels.push({file:'evidencias/final/'+file,sha256:hash(dest)});
  };
  await panel('comparativo-inicio.png','Três direções. Um próximo passo.','Mesmo contexto de estudo, hierarquia e componentes distintos.',Object.keys(styles).map(d=>({d,k:'inicio'})));
  await panel('comparativo-mapa.png','O caminho para entender.','Duolingo como base de progressão, com a identidade do Studoo.',Object.keys(styles).map(d=>({d,k:'mapa'})));
  for(const [d,style]of Object.entries(styles))await panel(`prancha-${style.letter}.png`,`${style.letter.toUpperCase()} · ${style.title}`,style.summary,['boasvindas','inicio','pedido','proposta','mapa','licao','exercicio','conclusao','perfil'].map(k=>({d,k})));
  for(const file of ['direcao-a.html','direcao-b.html','direcao-c.html','studoo-tres-direcoes.zip']){
   const dest=path.join(delivery,file);manifest.htmlBundles.push({file:'entrega/'+file,sha256:hash(dest)});
  }
  fs.writeFileSync(path.join(out,'manifesto-publicacao.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({images:manifest.images.length,pdfs:manifest.pdfs.length,panels:manifest.panels.length,directory:out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
