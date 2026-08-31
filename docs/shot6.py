from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for dark,out in [(False,"/tmp/sc2.png"),(True,"/tmp/sc2_dark.png")]:
        ctx=b.new_context(viewport={"width":1280,"height":1150},color_scheme="dark" if dark else "light")
        pg=ctx.new_page(); pg.goto("file:///home/claude/nb/research/scorecard.html"); pg.wait_for_timeout(2500)
        pg.evaluate("document.querySelector('.smx').scrollIntoView({block:'start'}); window.scrollBy(0,-90)")
        pg.wait_for_timeout(300); pg.screenshot(path=out)
        clipped = pg.evaluate("(()=>{const t=document.querySelector('.smx');return t.scrollWidth>t.clientWidth})()")
        print(out,"table clipped:",clipped)
        ctx.close()
    b.close()
