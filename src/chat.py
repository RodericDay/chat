import asyncio
import json
import signal

import websockets


online = set()


async def broadcast(data):
    string = json.dumps(data)
    asyncio.gather(*[ws.send(string) for ws in online])


async def handle(websocket):
    async for message in websocket:
        try:
            data = json.loads(message)
        except:
            await websocket.send(json.dumps({'kind': 'error', 'text': f'Error parsing {message}'}))

        try:
            match data['kind']:
                case 'login':
                    username = data['username']
                    online.add(websocket)
                    await broadcast({'kind': 'count', 'count': len(online)})
                case 'post':
                    if '!' in data['text']:
                        raise RuntimeError('No yelling, please.')
                    data['sender'] = username
                    await broadcast(data)
                case kind:
                    raise RuntimeError(f'Cannot handle message of type {kind}')
        except RuntimeError as error:
            await websocket.send(json.dumps({'kind': 'error', 'text': str(error)}))
        except Exception as error:
            await websocket.send(json.dumps({'kind': 'error', 'text': repr(error)}))

    online.discard(websocket)
    await broadcast({'kind': 'post', 'text': f'{len(online)} online'})


async def main():
    async with websockets.serve(handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

