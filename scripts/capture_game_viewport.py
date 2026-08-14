import asyncio
import base64
import json
import os
import urllib.request

import websockets


async def main():
    with urllib.request.urlopen('http://127.0.0.1:9222/json/list') as response:
        tabs = json.load(response)
    page = next(tab for tab in tabs if tab.get('type') == 'page' and 'cs-dm' in tab.get('url', ''))
    async with websockets.connect(page['webSocketDebuggerUrl'], max_size=None) as ws:
        counter = 0

        async def command(method, params=None):
            nonlocal counter
            counter += 1
            request_id = counter
            await ws.send(json.dumps({'id': request_id, 'method': method, 'params': params or {}}))
            while True:
                payload = json.loads(await ws.recv())
                if payload.get('id') == request_id:
                    return payload.get('result', {})

        async def key(code, key_value, pressed):
            await command('Input.dispatchKeyEvent', {
                'type': 'keyDown' if pressed else 'keyUp',
                'code': code,
                'key': key_value,
                'windowsVirtualKeyCode': ord(key_value.upper()) if len(key_value) == 1 else 0,
                'nativeVirtualKeyCode': ord(key_value.upper()) if len(key_value) == 1 else 0,
                'autoRepeat': False,
            })

        cursor_x, cursor_y = 640, 360

        async def move_mouse(delta_x, delta_y):
            nonlocal cursor_x, cursor_y
            next_x = max(80, min(1200, cursor_x + delta_x))
            next_y = max(120, min(600, cursor_y + delta_y))
            await command('Input.dispatchMouseEvent', {
                'type': 'mouseMoved', 'x': next_x, 'y': next_y, 'button': 'none', 'buttons': 0,
            })
            cursor_x, cursor_y = next_x, next_y

        async def fire():
            await command('Input.dispatchMouseEvent', {
                'type': 'mousePressed', 'x': 640, 'y': 360, 'button': 'left', 'buttons': 1, 'clickCount': 1,
            })
            await command('Input.dispatchMouseEvent', {
                'type': 'mouseReleased', 'x': 640, 'y': 360, 'button': 'left', 'buttons': 0, 'clickCount': 1,
            })

        await command('Page.enable')
        await command('Emulation.setDeviceMetricsOverride', {
            'width': 1280, 'height': 720, 'deviceScaleFactor': 1, 'mobile': False,
        })
        os.makedirs('/home/ubuntu/cs16-pr17/capture-frames', exist_ok=True)
        held = set()
        for frame in range(120):
            if frame == 0:
                await key('KeyW', 'w', True); held.add('KeyW')
            if frame == 30:
                await key('KeyW', 'w', False); held.discard('KeyW')
                await key('KeyD', 'd', True); held.add('KeyD')
            if frame == 60:
                await key('KeyD', 'd', False); held.discard('KeyD')
                await key('KeyA', 'a', True); held.add('KeyA')
            if frame == 90:
                await key('KeyA', 'a', False); held.discard('KeyA')
            if frame in {18, 30, 42, 54, 66, 78, 90, 102, 114}:
                await fire()
            if frame in {16, 32, 48, 64, 80, 96, 112}:
                await move_mouse(28 if (frame // 16) % 2 == 0 else -28, 2 if frame % 32 else -2)
            result = await command('Page.captureScreenshot', {
                'format': 'png', 'fromSurface': True, 'captureBeyondViewport': False,
            })
            with open(f'/home/ubuntu/cs16-pr17/capture-frames/frame-{frame:04d}.png', 'wb') as output:
                output.write(base64.b64decode(result['data']))
            await asyncio.sleep(1 / 24)
        for code in held:
            value = code[-1].lower()
            await key(code, value, False)
        await command('Emulation.clearDeviceMetricsOverride')


if __name__ == '__main__':
    asyncio.run(main())
