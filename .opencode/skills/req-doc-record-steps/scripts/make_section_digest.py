#!/usr/bin/env python3
# make_section_digest.py - catalog.json → 章节子树 + 可读摘要 + 图片清单
# 用法: python make_section_digest.py <catalog.json> <章节号,如 3.2> -o <输出目录>
# 产物: section-<n>.json(原始子树) / digest-<n>.txt(### 标题+正文+[TABLE]+[IMAGE src]) / imglist-<n>.md(章节→图片绝对路径)
import argparse, json, os, sys

WS = '\u2060\u200b\u00a0'

def clean_title(t):
    return (t or '').split('RQM_META')[0].translate({ord(c): None for c in WS}).strip()

def find_node(nodes, num):
    for n in nodes or []:
        if str(n.get('number', '')) == str(num):
            return n
        r = find_node(n.get('children'), num)
        if r is not None:
            return r
    return None

def walk(node, lines, imgs):
    title = clean_title(node.get('text'))
    num = node.get('number', '')
    if title:
        lines.append('### %s %s\n' % (num, title))
    for c in node.get('content') or []:
        t = c.get('type')
        if t == 'text':
            txt = (c.get('content') or '').translate({ord(c): ' ' for c in WS}).strip()
            if txt:
                lines.append(txt + '\n')
        elif t == 'table':
            lines.append('[TABLE]\n' + (c.get('content') or '').strip() + '\n')
        elif t == 'image':
            src = c.get('src', '')
            lines.append('[IMAGE %s]\n' % src)
            imgs.append((num, title, src))
    lines.append('\n')
    for ch in node.get('children') or []:
        walk(ch, lines, imgs)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('catalog')
    ap.add_argument('number', help='章节号, 如 3.2')
    ap.add_argument('-o', '--out', default='.')
    a = ap.parse_args()

    with open(a.catalog, encoding='utf-8') as f:
        cat = json.load(f)
    nodes = cat if isinstance(cat, list) else cat.get('children', [])
    node = find_node(nodes, a.number)
    if node is None:
        sys.exit('章节 %s 未在 catalog 中找到' % a.number)

    os.makedirs(a.out, exist_ok=True)
    sec_path = os.path.join(a.out, 'section-%s.json' % a.number)
    with open(sec_path, 'w', encoding='utf-8') as f:
        json.dump(node, f, ensure_ascii=False, indent=1)

    lines, imgs = [], []
    walk(node, lines, imgs)
    dig_path = os.path.join(a.out, 'digest-%s.txt' % a.number)
    with open(dig_path, 'w', encoding='utf-8') as f:
        f.write(''.join(lines))

    base = os.path.dirname(os.path.abspath(a.catalog))
    il = ['# %s 章图片清单（src 相对 %s）' % (a.number, base), '']
    for num, title, src in imgs:
        il.append('- [%s %s] %s -> %s' % (num, title, src, os.path.normpath(os.path.join(base, src))))
    il_path = os.path.join(a.out, 'imglist-%s.md' % a.number)
    with open(il_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(il) + '\n')

    print('section -> %s' % sec_path)
    print('digest  -> %s' % dig_path)
    print('images  -> %d 张, 见 %s' % (len(imgs), il_path))

if __name__ == '__main__':
    main()
