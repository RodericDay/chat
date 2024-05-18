import asyncio
import json
import signal

import websockets


async def simple_echo_handle(websocket):
    async for message in websocket:
        try:
            text = json.loads(message)['text']
            if '!' in text:
                raise RuntimeError('No yelling, please.')
            await websocket.send(message)
        except Exception as error:
            await websocket.send(json.dumps({'kind': 'error', 'text': f'{message} produced {error!r}'}))


async def main():
    async with websockets.serve(simple_echo_handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

