const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = __dirname;
(async () => {
 const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox'] });
 const rows = [];
 for (const width of [390,360]) for (const scale of [100,200]) {
  const context = await browser.newContext({ viewport:{width,height:width===390?844:800}, deviceScaleFactor:2, reducedMotion:'reduce' });
  const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3031/boas-vindas/',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  if (scale===200) await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  for (let i=0;i<3;i++) {
   if(i) await page.locator('#next').click();
   const file=`beneficio-${i+1}-${width}-${scale}.png`;
   await page.screenshot({path:path.join(out,file),fullPage:true});
   const data=await page.evaluate(()=>({title:document.querySelector('.slide:not([hidden]) h1').innerText,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,activeDots:document.querySelectorAll('[aria-current="step"]').length,cta:document.querySelector('#next').innerText,controls:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length).map(e=>({text:e.getAttribute('aria-label')||e.innerText,rect:e.getBoundingClientRect().toJSON()})),images:[...document.querySelectorAll('img')].every(e=>e.complete&&e.naturalWidth>0)}));
   rows.push({width,scale,slide:i+1,file,...data,errors:[...errors]});
  }
  await page.locator('#next').click();
  rows.push({width,scale,dialog:await page.locator('#create-preview').evaluate(e=>e.open),existingAccount:await page.locator('.actions .existing-account').getAttribute('href'),errors:[...errors]});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'medidas.json'),JSON.stringify({origin:'proposta HTML local, não app instalado; exemplos estáticos, sem API/cadastro/persistência',rows},null,2));
 console.log(JSON.stringify({captures:rows.filter(r=>r.file).length,overflow:rows.filter(r=>r.scrollWidth>r.width),errors:rows.flatMap(r=>r.errors),normal:rows.filter(r=>r.scale===100&&r.file).map(r=>({slide:r.slide,width:r.width,height:r.scrollHeight,cta:r.cta}))}));
 await browser.close();
})();
