from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for path,out,sel in [("design/architecture-v3.html","/tmp/v3_top.png",None),
                         ("design/architecture-v3.html","/tmp/v3_cost.png","h2#the-three-lanes,h2"),
                         ("index.html","/tmp/idx3.png",None)]:
        ctx=b.new_context(viewport={"width":1280,"height":1050}); pg=ctx.new_page(); errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.goto("file:///home/claude/nb/"+path); pg.wait_for_timeout(4000)
        pg.screenshot(path=out)
        print(path,"mermaid",pg.eval_on_selector_all(".mermaid","e=>e.length"),
              "rendered",pg.eval_on_selector_all(".mermaid svg","e=>e.length"),"err",errs[:2])
        ctx.close()
    b.close()
