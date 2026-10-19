#!/usr/bin/env python3
"""Собирает одну страницу для Claude из исходников сайта.

Отличия от сайта: всё в одном файле, онлайн идёт через комнату Claude
(js/transport-room.js) вместо PeerJS, нет манифеста и сброса стилей страницы.

    python3 tools/build-artifact.py [путь-к-результату]
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'durocker-claude.html'
SCRIPTS = ['rules', 'engine', 'bot', 'meta', 'net', 'transport-room', 'audio', 'vfx', 'ui', 'tutorial', 'voices', 'cheat', 'weekly', 'multi/engine4', 'multi/bot4', 'multi/transport4', 'multi/net4', 'multi/ui4', 'replay', 'quick', 'pass', 'cloud', 'leaders', 'tg', 'main']

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css' / 'style.css').read_text(encoding='utf-8')
css = re.sub(r'/\* standalone:start.*?/\* standalone:end \*/\n?', '', css, flags=re.S)

title = re.search(r'<title>.*?</title>', html).group(0)
fonts = '\n'.join(m.group(0) for m in re.finditer(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]*>', html))
body = html[html.index('<body>') + len('<body>'):html.index('<script')].strip()
js = '\n'.join((ROOT / 'js' / f'{name}.js').read_text(encoding='utf-8') for name in SCRIPTS)

page = f'''{title}
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>
{css}</style>

{body}

<script>
{js}
</script>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page, encoding='utf-8')
print(f'{OUT} — {len(page) // 1024} КБ')
