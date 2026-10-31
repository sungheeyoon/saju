#!/usr/bin/env python3
"""라우트를 딥 링크로 차례로 열고 그림 · 글자 · 새 Metro 로그를 모은다. 누르지 않는다.
  sweep.py 이름=경로 ...

환경: W(한 화면 기다리는 초, 기본 5) · MEASURE_DIR/metro.log(Metro 출력을 여기로 받았을 때만 로그를 읽는다).
"""
import os, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('MEASURE_DIR', os.path.join(tempfile.gettempdir(), 'saju-measure'))
METRO = os.path.join(OUT, 'metro.log')
RED = ('Render Error', 'Uncaught Error', 'Reload JS', 'Component Stack', 'Call Stack', '문제가 생겼', '다시 시도', 'TOOLS')


def d(*args):
    return subprocess.run(['python3', os.path.join(HERE, 'device.py'), *args], capture_output=True, text=True).stdout


def size():
    return os.path.getsize(METRO) if os.path.exists(METRO) else 0


for item in sys.argv[1:]:
    name, path = item.split('=', 1)
    start = size()
    d('link', path)
    time.sleep(int(os.environ.get('W','5')))
    d('shot', name)
    words = [w for w in d('texts').split('\n') if w]
    new = []
    if os.path.exists(METRO):
        with open(METRO, errors='replace') as f:
            f.seek(start)
            new = [l.rstrip()[:220] for l in f if l.strip() and 'Bundled' not in l]
    flag = [w for w in words if any(r in w for r in RED)]
    print(f'=== {name} {path} 글자{len(words)} {"FLAG " + str(flag) if flag else ""}')
    print('  ' + ' / '.join(w[:26] for w in words[:32]))
    for line in new[:8]:
        print('  LOG', line)
