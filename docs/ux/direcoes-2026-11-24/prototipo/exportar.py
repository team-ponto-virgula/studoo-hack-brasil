"""Empacota os três protótipos próprios, sem rede, para abertura offline."""
import base64
import json
import mimetypes
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent
out = root.parent / "entrega"
out.mkdir(exist_ok=True)
css = "\n".join((root / p).read_text() for p in ["base.css", "directions/jornada.css", "directions/caderno.css", "directions/foco.css", "accessibility.css"])
assets = {}
for p in (root / "assets").iterdir():
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    assets[p.name] = "data:" + mime + ";base64," + base64.b64encode(p.read_bytes()).decode()
for name in ["nunito.woff2", "quicksand.woff2"]:
    css = css.replace("assets/" + name, assets[name])
code = (root / "app.js").read_text()
extra = """
body.standalone .app{height:calc(100svh - 76px)}.offline-bar{height:76px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:5px 12px;background:#edf1f8;border-bottom:1px solid #cbd6e8;color:#142453;font:12px/1.2 Nunito,sans-serif}.offline-bar>div{display:flex;gap:8px}.offline-bar label{display:flex;align-items:center;gap:6px;flex:1;min-width:0}.offline-bar select{font:700 12px/1.2 Nunito,sans-serif;min-height:38px;padding:6px;width:100%;min-width:0;background:white;color:#142453;border:1px solid #8996b1;border-radius:8px}.offline-bar small{font-size:12px}
"""
bootstrap = """
const offPage=document.getElementById('offline-page');offPage.innerHTML=Object.entries(window.STUDOO_PAGES).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');offPage.value=page;offPage.onchange=e=>go(e.target.value);const offVariant=document.getElementById('offline-direction');offVariant.value=direction;offVariant.onchange=e=>{const keys={jornada:'a',caderno:'b',foco:'c'};location.href='direcao-'+keys[e.target.value]+'.html?p='+page;};new MutationObserver(()=>{offPage.value=page;}).observe(root,{childList:true});
"""
for letter, direction, title in [("a", "jornada", "Jornada Azul"), ("b", "caderno", "Caderno Claro"), ("c", "foco", "Foco Vivo")]:
    html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Studoo · '+title+'</title><style>'+css+extra+'</style></head><body class="standalone" data-direction="'+direction+'"><aside class="offline-bar" aria-label="Bancada do protótipo"><small>Proposta de interface · dados locais · sem API/IA/microfone</small><div><label>Direção<select id="offline-direction"><option value="jornada">A · Jornada Azul</option><option value="caderno">B · Caderno Claro</option><option value="foco">C · Foco Vivo</option></select></label><label>Página<select id="offline-page"></select></label></div></aside><div id="app" class="app"></div><div id="toast" role="status" aria-live="polite"></div><script>window.STUDOO_ASSETS='+json.dumps(assets)+';</script><script>'+code+'</script><script>'+bootstrap+'</script></body></html>'
    (out / ("direcao-" + letter + ".html")).write_text(html)
(out / "LEIA-ME.txt").write_text("STUDOO — três direções mobile\n\nAbra direcao-a.html, direcao-b.html ou direcao-c.html em um navegador. Fontes, assets e código estão incluídos; não é necessário servidor. A barra superior escolhe página/direção. As ações são locais; não há login, IA, gravação ou salvamento em servidor. O personagem é o kit provisório atual, não o novo Stu caderno. Testes nativos permanecem pendentes.\n\nCritérios e resultados: ../RESULTADOS.md no repositório desta tarefa.\n")
with zipfile.ZipFile(out / "studoo-tres-direcoes.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in out.iterdir():
        if p.suffix in {".html", ".txt"}:
            z.write(p, p.name)
print(json.dumps({"files": [p.name for p in out.iterdir()], "htmlBytes": {p.name: p.stat().st_size for p in out.glob('*.html')}}))
