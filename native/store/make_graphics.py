#!/usr/bin/env python3
"""Графика для Google Play: иконка 512, feature graphic 1024x500, скриншоты телефона и планшетов.
Запуск из корня репозитория: python3 native/store/make_graphics.py
Нужно: playwright (chromium), Pillow. Сайт отдаётся локальным http-сервером, внешних запросов нет."""
import os, sys, threading, http.server, functools, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'native', 'store', 'graphics')
os.makedirs(OUT, exist_ok=True)

def font(size, bold=True):
    for pat in ('/usr/share/fonts/**/Inter*Bold*.ttf', '/usr/share/fonts/**/Inter*.ttf', '/usr/share/fonts/**/DejaVuSans-Bold.ttf'):
        fs = sorted(glob.glob(pat, recursive=True))
        if fs:
            return ImageFont.truetype(fs[0], size)
    return ImageFont.load_default()

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/index.html' % srv.server_address[1]

INIT = """try{localStorage.setItem('durocker-tut','skip');localStorage.setItem('durocker-speed','off');
localStorage.setItem('durocker-nick','Саня');localStorage.setItem('durocker-chips','850');}catch(e){}"""

STEP = """() => {
  const vis = e => e && !e.disabled && e.offsetParent !== null;
  const sh = document.querySelector('.sheet:not([hidden]) [data-close]'); if (sh) { sh.click(); return 'close'; }
  const off = document.getElementById('offer');
  if (off && !off.hidden) { const b = off.querySelector('button:not([disabled])'); if (b) { b.click(); return 'offer'; } }
  const mains = () => [...document.querySelectorAll('#actMain button')];
  if (!mains().length) return '';
  if (!mains().some(vis)) { const p = document.getElementById('pickBtn'); if (vis(p)) p.click(); return 'pick'; }
  mains().find(vis).click(); return 'act';
}"""

def over(page):
    return page.evaluate("() => { const o = document.getElementById('over'); return !!o && !o.hidden && o.offsetParent !== null; }")

def play(page, clicks, until_over=False):
    n = 0
    for _ in range(4000):
        if over(page):
            break
        d = page.evaluate(STEP)
        if d and d != 'close':
            n += 1
        page.wait_for_timeout(70 if d else 130)
        if not until_over and n >= clicks:
            break

def fresh(ctx):
    page = ctx.new_page()
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
    page.goto(BASE)
    page.wait_for_timeout(1500)
    return page

def close_all(page):
    for _ in range(4):
        c = page.locator('.sheet:not([hidden]) [data-close]').first
        if c.count():
            try: c.click(timeout=1000)
            except Exception: pass
            page.wait_for_timeout(200)

def banner(img, caption, bh, W):
    """Подпись сверху: тёмная плашка с заголовком; img — снимок экрана, итог W x (H)."""
    H = img.height + bh
    canvas = Image.new('RGB', (W, H), (6, 25, 26))
    d = ImageDraw.Draw(canvas)
    for y in range(bh):
        t = y / bh
        d.line([(0, y), (W, y)], fill=(int(15 + 10 * t), int(59 - 12 * t), int(44 - 8 * t)))
    fs = int(bh * 0.40)
    f = font(fs)
    words, lines, cur = caption.split(), [], ''
    while True:
        lines, cur = [], ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=f) <= W * 0.9: cur = t
            else: lines.append(cur); cur = w
        lines.append(cur)
        if len(lines) <= 2 or fs < 20: break
        fs -= 4; f = font(fs)
    th = sum(f.getbbox(l)[3] for l in lines) + 8 * (len(lines) - 1)
    y = (bh - th) // 2
    for l in lines:
        w = d.textlength(l, font=f)
        d.text(((W - w) / 2 + 2, y + 2), l, font=f, fill=(0, 0, 0))
        d.text(((W - w) / 2, y), l, font=f, fill=(245, 215, 110))
        y += f.getbbox(l)[3] + 8
    canvas.paste(img, (0, bh))
    return canvas

def shot(page, name, caption, W, H, scale, bh):
    raw = os.path.join(OUT, '_raw.png')
    page.screenshot(path=raw)
    img = Image.open(raw).convert('RGB')
    if img.size != (W, H - bh):
        img = img.resize((W, H - bh), Image.LANCZOS)
    banner(img, caption, bh, W).save(os.path.join(OUT, name), optimize=True)
    os.remove(raw)

# (папка, имя, ширина css, высота css, dsf, высота плашки px, сцены)
SETS = {
    'phone': (360, 573, 3, 201, 'phone'),      # 1080 x 1920
    'tablet7': (600, 861, 2, 180, 'tablet7'),   # 1200 x 1920 (7")
    'tablet10': (800, 1190, 2, 180, 'tablet10') # 1600 x 2560 (10")
}

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None, args=['--no-sandbox'])
        for key, (w, h, dsf, bh, pre) in SETS.items():
            W, H = w * dsf, h * dsf + bh
            if key == 'tablet10': H = 2560; h = (H - bh) // dsf
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, service_workers='block', is_mobile=True, has_touch=True)
            ctx.add_init_script(INIT)
            n = 0
            def S(name, cap, page):
                nonlocal n
                n += 1
                shot(page, f'{pre}-{n:02d}-{name}.png', cap, W, H, dsf, bh)
            # 1. лобби
            page = fresh(ctx)
            S('lobby', 'Дурак, где отбиваются покером', page)
            # 2. карточка соперника / карьера
            try:
                page.locator('.lb-play').first.click(timeout=2000); page.wait_for_timeout(900)
                S('career', 'Карьера: с подъезда в казино', page)
            except Exception as e:
                print('career:', e)
            # 3-4. партия
            close_all(page); page.wait_for_timeout(600)
            play(page, 6)
            S('table', 'Бей комбинациями: пара, стрит, флеш', page)
            if key == 'phone':
                play(page, 5)
                S('table2', '«Могнул»: перекрой комбинацией старше', page)
            # итог
            play(page, 0, until_over=True); page.wait_for_timeout(1200)
            S('result', 'Матч до двух побед', page)
            # меню-окна
            for go, cap in (('rogue', 'Ночь в казино: 8 боссов подряд'), ('profile', 'Профиль и 57 достижений')) + ((('story', 'Соперники помнят тебя'),) if key == 'phone' else ()):
                try:
                    page.evaluate("() => { try { closeSheets && 0 } catch(e){} }")
                    page.evaluate(f"() => {{ openMenu(); menuGo('{go}'); }}"); page.wait_for_timeout(900)
                    S(go, cap, page)
                except Exception as e:
                    print(go, e)
            ctx.close()
        b.close()

def icon_and_feature():
    src = Image.open(os.path.join(ROOT, 'assets', 'icon-512.png')).convert('RGBA')
    bg = Image.new('RGBA', src.size, (15, 59, 44, 255)); bg.alpha_composite(src)
    bg.convert('RGBA').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'), optimize=True)
    # feature graphic 1024x500
    fg = Image.new('RGB', (1024, 500), (6, 25, 26)); d = ImageDraw.Draw(fg)
    for x in range(1024):
        t = x / 1024; d.line([(x, 0), (x, 500)], fill=(int(8 + 14 * t), int(40 + 22 * (1 - abs(t - .35))), int(34 + 6 * t)))
    ic = src.resize((300, 300), Image.LANCZOS); fg.paste(ic, (70, 100), ic)
    f1, f2 = font(110), font(38)
    d.text((410, 120), 'ДурКер', font=f1, fill=(245, 215, 110))
    d.text((414, 262), 'Дурак, где отбиваются', font=f2, fill=(235, 235, 225))
    d.text((414, 310), 'покерными комбинациями', font=f2, fill=(235, 235, 225))
    for i, (s, c) in enumerate((('♠', (235, 235, 225)), ('♥', (230, 80, 80)), ('♦', (230, 80, 80)), ('♣', (235, 235, 225)))):
        d.text((416 + i * 52, 390), s, font=font(52), fill=c)
    fg.save(os.path.join(OUT, 'feature-graphic-1024x500.png'), optimize=True)

if __name__ == '__main__':
    icon_and_feature()
    run()
    srv.shutdown()
    print(sorted(os.listdir(OUT)))
