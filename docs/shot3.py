from playwright.sync_api import sync_playwright
targets=[("design/architecture-v2.html","/tmp/v2_top.png",None),
         ("design/architecture-v2.html","/tmp/v2_org.png",".mermaid"),
         ("research/cursor-capabilities.html","/tmp/cc.png",None),
         ("index.html","/tmp/idx2.png",None)]
with sync_playwright() as p:
    b=p.chromium.launch()
    for path,out,sel in targets:
        ctx=b.new_context(viewport={"width":1280,"height":1050})
        pg=ctx.new_page(); errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.goto("file:///home/claude/nb/"+path); pg.wait_for_timeout(4000)
        if sel: pg.eval_on_selector(sel,"e=>e.scrollIntoView({block:'start'})"); pg.wait_for_timeout(500)
        pg.screenshot(path=out)
        n=pg.eval_on_selector_all(".mermaid svg","e=>e.length"); m=pg.eval_on_selector_all(".mermaid","e=>e.length")
        print(path,"mermaid",m,"rendered",n,"errors",errs[:2])
        ctx.close()
    b.close()
