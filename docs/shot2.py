from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for dark,out in [(False,"/tmp/s_mm.png"),(True,"/tmp/s_mm_dark.png")]:
        ctx=b.new_context(viewport={"width":1280,"height":1100},color_scheme="dark" if dark else "light")
        pg=ctx.new_page(); pg.goto("file:///home/claude/nb/design/architecture.html"); pg.wait_for_timeout(3500)
        pg.eval_on_selector(".mermaid","e=>e.scrollIntoView({block:'center'})"); pg.wait_for_timeout(400)
        pg.screenshot(path=out); ctx.close()
    b.close()
