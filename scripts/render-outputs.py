# -*- coding: utf-8 -*-
import asyncio, glob, os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path('/home/z/my-project/download/preview-outputs')
FILES = ['01-gharardad-mohammadi', '02-hokm-mohammadi', '03-fish-hoghughi-mohammadi', '04-tasviye-hesab-mohammadi']

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        for f in FILES:
            await pg.goto('file://' + str(OUT / (f + '.html')))
            await pg.wait_for_timeout(300)
            await pg.pdf(path=str(OUT / (f + '.pdf')), prefer_css_page_size=True, print_background=True)
            print('pdf', f)
        await b.close()

asyncio.run(main())
print('done')
