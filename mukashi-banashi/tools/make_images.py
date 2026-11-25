# assets/images.js を つくる（node tests.js で 絵の なまえを たしかめる）
#   assets/emoji/<なまえ>.webp → 'なまえ'（Fluent Emoji 3D）
#   assets/e/<なまえ>.jpg      → 'pd:なまえ'（むかしの 絵本の 絵。tools/pd_list.json に せつめい）
import json, os, glob
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
out = {}
for p in sorted(glob.glob(os.path.join(root, 'assets/emoji/*.webp'))):
    k = os.path.basename(p)[:-5]; out[k] = {'src': 'assets/emoji/' + k + '.webp', 't': 'e'}
pdl = os.path.join(here, 'pd_list.json')
meta = json.load(open(pdl, encoding='utf-8')) if os.path.exists(pdl) else {}
for p in sorted(glob.glob(os.path.join(root, 'assets/e/*.jpg'))):
    k = os.path.basename(p)[:-4]; out['pd:' + k] = {'src': 'assets/e/' + k + '.jpg', 't': 'p', 'alt': meta.get(k, {}).get('alt', '')}
with open(os.path.join(root, 'assets/images.js'), 'w', encoding='utf-8') as f:
    f.write('/* むかしばなし文庫 ── 絵の いちらん（tools/make_images.py で つくる。手で なおさない） */\n')
    f.write('window.MB_IMAGES = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
print(len(out), 'images')
