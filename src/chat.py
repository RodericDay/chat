import asyncio
import datetime
import json
import signal

import websockets


online = {}


async def broadcast(data):
    if usernames := data.get('targets'):
        targets = [online[username] for username in usernames]
    else:
        targets = list(online.values())
    string = json.dumps(data)
    asyncio.gather(*[ws.send(string) for ws in targets])


async def handle(websocket):
    username = json.loads(await websocket.recv())['username']
    if not username:
        await websocket.send('Username cannot be blank')
    elif username in online:
        await websocket.send('Username taken')
        username = None

    else:
        try:

            await broadcast({'kind': 'enter', 'username': username})
            online[username] = websocket

            async for message in websocket:
                data = json.loads(message)
                data['timestamp'] = datetime.datetime.now().isoformat()
                data['sender'] = username
                await broadcast(data)

        finally:

            online.pop(username, None)
            await broadcast({'kind': 'leave', 'username': username})


async def main():
    async with websockets.serve(handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    version = 2
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

