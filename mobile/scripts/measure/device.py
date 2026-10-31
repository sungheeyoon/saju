#!/usr/bin/env python3
"""기기 조작 한 벌 — 글자로 찾아 누른다. 좌표를 손으로 주지 않는다.
  device.py link /me/chat            딥 링크로 라우트를 연다
  device.py shot name                MEASURE_DIR/name.png 로 찍는다
  device.py texts                    화면의 글자 목록
  device.py tap 글자 [n]             글자 · 설명이 정확히 같은 n 번째를 누른다(없으면 포함으로)
  device.py input [n]                n 번째 입력칸에 초점을 준다 — type 앞에 반드시
  device.py type 글자                한글은 못 넣어 영문 · 숫자만. 초점이 없으면 RN 단축키로 먹는다
  device.py key 4                    keyevent
  device.py swipe-up                 한 화면 올린다
  device.py err                      ReactNativeJS 오류 줄

환경: ADB(기본 `adb`, WSL 은 Windows SDK 의 adb.exe) · MEASURE_DIR(그림 자리, 저장소 밖). 차례는
`docs/agents/delegation/local-env.md` 「앱을 네이티브로 재기」.
"""
import os, re, subprocess, sys, tempfile, time, xml.etree.ElementTree as ET

ADB = os.environ.get('ADB', 'adb')
OUT = os.environ.get('MEASURE_DIR', os.path.join(tempfile.gettempdir(), 'saju-measure'))
os.makedirs(OUT, exist_ok=True)
RED = ('Render Error', 'Uncaught Error', 'Reload JS', 'Dismiss', 'Minimize', 'Component Stack', 'Call Stack', 'Log 1 of')


def adb(*args, binary=False, timeout=40):
    out = subprocess.run([ADB, *args], capture_output=True, timeout=timeout)
    return out.stdout if binary else out.stdout.decode('utf-8', 'replace')


def nodes():
    for _ in range(4):
        raw = adb('exec-out', 'sh', '-c', 'uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml')
        at = raw.find('<?xml')
        if at >= 0:
            try:
                return list(ET.fromstring(raw[at:]).iter('node'))
            except ET.ParseError:
                pass
        time.sleep(1)
    return []


def texts():
    out = []
    for n in nodes():
        for attr in ('text', 'content-desc'):
            v = n.get(attr)
            if v:
                out.append(v)
    return out


def bounds(n):
    a, b, c, d = map(int, re.findall(r'\d+', n.get('bounds')))
    return a, b, c, d


def red_screen(found):
    return [t for t in found if any(r in t for r in RED)]


def tap(word, index=0):
    all_nodes = nodes()
    found = [t for n in all_nodes for t in (n.get('text'), n.get('content-desc')) if t]
    if red_screen(found) and word not in ('Dismiss', 'Reload JS', 'Minimize'):
        print('RED SCREEN — 누르지 않는다', red_screen(found))
        return False
    exact = [n for n in all_nodes if word in (n.get('text'), n.get('content-desc'))]
    hits = exact or [n for n in all_nodes if word in (n.get('text') or '') or word in (n.get('content-desc') or '')]
    if len(hits) <= index:
        print('없음', word)
        return False
    a, b, c, d = bounds(hits[index])
    adb('shell', 'input', 'tap', str((a + c) // 2), str((b + d) // 2))
    print('눌렀다', word, (a + c) // 2, (b + d) // 2)
    return True


def main():
    cmd = sys.argv[1]
    if cmd == 'link':
        path = sys.argv[2]
        # 패키지 인자를 붙이지 않는다 — 함정 표는 local-env.md
        url = 'exp://127.0.0.1:8081/--' + path
        print(adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', "'" + url + "'").strip()[:120])
    elif cmd == 'shot':
        png = adb('exec-out', 'screencap', '-p', binary=True)
        target = os.path.join(OUT, sys.argv[2] + '.png')
        with open(target, 'wb') as f:
            f.write(png)
        print(target, len(png))
    elif cmd == 'texts':
        print('\n'.join(texts()))
    elif cmd == 'tap':
        tap(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0)
    elif cmd == 'input':
        hits = [n for n in nodes() if n.get('class') == 'android.widget.EditText']
        a, b, c, e = bounds(hits[int(sys.argv[2]) if len(sys.argv) > 2 else 0])
        adb('shell', 'input', 'tap', str((a + c) // 2), str((b + e) // 2))
        print('입력칸', a, b, c, e, len(hits))
    elif cmd == 'type':
        adb('shell', 'input', 'text', sys.argv[2])
    elif cmd == 'key':
        adb('shell', 'input', 'keyevent', sys.argv[2])
    elif cmd == 'swipe-up':
        adb('shell', 'input', 'swipe', '540', '1800', '540', '700', '350')
    elif cmd == 'err':
        raw = adb('logcat', '-d', '-s', 'ReactNativeJS:E', 'ReactNativeJS:W', timeout=30)
        print(raw[-6000:])


main()
