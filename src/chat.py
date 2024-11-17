import asyncio
import collections
import datetime
import json
import signal

import websockets


rooms = collections.defaultdict(dict)


async def broadcast(room, data):
    if usernames := data.get('targets'):
        targets = [room[username] for username in usernames]
    else:
        targets = list(room.values())
    string = json.dumps(data)
    asyncio.gather(*[ws.send(string) for ws in targets])


async def handle(websocket):
    room = rooms[websocket.request.path]
    username = json.loads(await websocket.recv())['username']
    if not username:
        await websocket.send('Username cannot be blank')
    elif username in room:
        await websocket.send('Username taken')
        username = None

    else:
        try:

            await broadcast(room, {'kind': 'enter', 'username': username})
            room[username] = websocket

            async for message in websocket:
                data = json.loads(message)
                data['timestamp'] = datetime.datetime.now().isoformat()
                data['sender'] = username
                await broadcast(room, data)

        finally:

            room.pop(username, None)
            await broadcast(room, {'kind': 'leave', 'username': username})


async def main(port=9754):
    async with websockets.serve(handle, '0.0.0.0', port):
        print('Server started.')
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    version = 2
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

