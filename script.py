import asyncio
import signal

import websockets


async def simple_echo_handle(websocket):
    async for message in websocket:
        await websocket.send(message)


async def main():
    async with websockets.serve(simple_echo_handle, '0.0.0.0', 9754):
        await asyncio.Future()  # just means forever


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda: error)  # kill gracelessly upon sigterm
    asyncio.run(main())

