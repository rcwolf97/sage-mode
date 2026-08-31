from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for path,out,dark,sel in [("research/scorecard.html","/tmp/sc.png",False,".smx"),
                              ("research/scorecard.html","/tmp/sc_dark.png",True,".smx"),
                              ("design/design-org.html","/tmp/do.png",False,None)]:
        ctx=b.new_context(viewport={"width":1280,"height":1150},color_scheme="dark" if dark else "light")
        pg=ctx.new_page(); errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.goto("file:///home/claude/nb/"+path); pg.wait_for_timeout(3800)
        if sel: pg.eval_on_selector(sel,"e=>e.scrollIntoView({block:'start'})"); pg.wait_for_timeout(400)
        pg.screenshot(path=out)
        print(path,"err",errs[:2],"| overflow:",pg.evaluate("document.body.scrollWidth>window.innerWidth"))
        ctx.close()
    b.close()
