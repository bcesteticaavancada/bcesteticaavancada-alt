from pathlib import Path

path = Path('protocolos/index.html')
html = path.read_text(encoding='utf-8')
old = '''        <article class="protocol-video-card" data-protocol-video="renovacao" data-video-state="pending">
          <div class="protocol-video-media"><img src="../assets/procedimentos/catalogo/14-microagulhamento.webp" alt="Apresentação ilustrativa de microagulhamento" width="1122" height="1402" loading="lazy" decoding="async"></div>
          <div class="protocol-video-copy"><span>05 · Textura</span><h3>Microagulhamento &amp; Renovação</h3><p>Um eixo de cuidados para textura e renovação que pode incluir microagulhamento, peelings e estratégias despigmentantes.</p></div>
        </article>'''
new = '''        <article class="protocol-video-card" data-protocol-video="renovacao" data-video-state="ready">
          <div class="protocol-video-media"><video poster="../assets/procedimentos/catalogo/14-microagulhamento.webp" muted playsinline preload="none" controls aria-label="Vídeo explicativo sobre Black Peel"><source data-src="../assets/procedimentos/black-peel.mp4" type="video/mp4"></video></div>
          <div class="protocol-video-copy"><span>05 · Textura</span><h3>Black Peel</h3><p>Protocolo de renovação da pele escolhido conforme avaliação, com foco em textura, oleosidade e uniformidade do aspecto cutâneo.</p></div>
        </article>'''
if old not in html:
    raise SystemExit('Expected renovation card was not found; refusing broad replacement')
path.write_text(html.replace(old, new, 1), encoding='utf-8')
