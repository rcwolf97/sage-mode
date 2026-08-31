from playwright.sync_api import sync_playwright
import sys
pages=[("index.html","/tmp/s_index.png",False),
       ("design/architecture.html","/tmp/s_arch.png",False),
       ("design/architecture.html","/tmp/s_arch_dark.png",True)]
with sync_playwright() as p:
    b=p.chromium.launch()
    for path,out,dark in pages:
        ctx=b.new_context(viewport={"width":1280,"height":1000},color_scheme="dark" if dark else "light")
        pg=ctx.new_page()
        errs=[]
        pg.on("console", lambda m: errs.append(m.type+": "+m.text) if m.type=="error" else None)
        pg.goto("file:///home/claude/nb/"+path)
        pg.wait_for_timeout(3500)
        pg.screenshot(path=out, full_page=False)
        print(path, "console errors:", errs[:3])
        # check mermaid rendered
        n=pg.eval_on_selector_all(".mermaid svg","els=>els.length")
        m=pg.eval_on_selector_all(".mermaid","els=>els.length")
        print("  mermaid blocks:",m,"rendered svg:",n)
        ctx.close()
    b.close()
