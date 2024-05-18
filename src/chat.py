import asyncio
import datetime
import json
import signal

import websockets


online = {}


async def broadcast(string):
    asyncio.gather(*[ws.send(string) for ws in online.values()])


async def handle(websocket):
    try:
        await websocket.send(json.dumps({'kind': 'version', 'version': version}))
        username = json.loads(await websocket.recv())['username']
        if not username:
            await websocket.send('Username cannot be blank')
        elif username in online:
            await websocket.send('Username taken')
            username = None
        else:
            online[username] = websocket
            await broadcast(json.dumps({'kind': 'users', 'users': list(online)}))
            async for message in websocket:
                data = json.loads(message)
                if data['kind'] == 'logout':
                    await websocket.send(message)
                    break
                data['timestamp'] = datetime.datetime.now().isoformat()
                data['sender'] = username
                if data['kind'] == 'post':
                    await broadcast(json.dumps(data))
    finally:
        online.pop(username, None)
        await broadcast(json.dumps({'kind': 'users', 'users': list(online)}))


async def main():
    async with websockets.serve(handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    version = 2
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

