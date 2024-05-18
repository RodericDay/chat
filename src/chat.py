import asyncio
import json
import signal

import websockets


online = set()


async def broadcast(data):
    string = json.dumps(data)
    asyncio.gather(*[ws.send(string) for ws in online])


async def handle(websocket):
    online.add(websocket)
    await broadcast({'kind': 'count', 'count': len(online)})
    async for message in websocket:
        try:
            data = json.loads(message)
            if '!' in data['text']:
                raise RuntimeError('No yelling, please.')
            await broadcast(data)
        except Exception as error:
            await websocket.send(json.dumps({'kind': 'error', 'text': str(error)}))
    online.discard(websocket)
    await broadcast({'kind': 'count', 'count': len(online)})


async def main():
    async with websockets.serve(handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

