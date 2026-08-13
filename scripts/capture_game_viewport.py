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

        async def move_mouse(delta_x, delta_y):
            await command('Input.dispatchMouseEvent', {
                'type': 'mouseMoved', 'x': 640, 'y': 360, 'button': 'none', 'buttons': 0,
                'deltaX': delta_x, 'deltaY': delta_y,
            })

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
        for frame in range(360):
            if frame == 0:
                await key('KeyW', 'w', True); held.add('KeyW')
            if frame == 48:
                await key('KeyW', 'w', False); held.discard('KeyW')
                await key('KeyD', 'd', True); held.add('KeyD')
            if frame == 96:
                await key('KeyD', 'd', False); held.discard('KeyD')
                await key('KeyA', 'a', True); held.add('KeyA')
            if frame == 144:
                await key('KeyA', 'a', False); held.discard('KeyA')
                await key('KeyW', 'w', True); held.add('KeyW')
            if (frame < 60 and frame % 4 == 0) or frame in {70, 78, 96, 102, 108, 114, 156, 162, 168, 174, 204, 210, 216, 222, 270, 276, 282}:
                await fire()
            if frame in {72, 84, 106, 128, 150, 174, 198, 222, 246, 270, 294, 318}:
                await move_mouse(46 if (frame // 22) % 2 == 0 else -62, -8 if frame % 44 == 0 else 3)
            if frame == 80:
                await key('KeyR', 'r', True); await key('KeyR', 'r', False)
            if frame == 138:
                await key('Digit2', '2', True); await key('Digit2', '2', False)
            if frame == 188:
                await key('Tab', 'Tab', True)
            if frame == 212:
                await key('Tab', 'Tab', False)
            if frame == 216:
                await key('KeyB', 'b', True); await key('KeyB', 'b', False)
            if frame == 232:
                await key('Escape', 'Escape', True); await key('Escape', 'Escape', False)
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
