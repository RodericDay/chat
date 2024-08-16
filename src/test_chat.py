import asyncio
import json

import pytest
import websockets

import chat


async def test_echo():
    task = asyncio.create_task(chat.main(9755))
    async with websockets.connect('ws://localhost:9755/secret') as websocket:
        await websocket.send(json.dumps({'username': 'Alice'}))
        await websocket.send(json.dumps({'message': 'Hello!'}))

        data = json.loads(await websocket.recv())
        assert data['message'] == 'Hello!'
    task.cancel()


async def test_room():
    task = asyncio.create_task(chat.main(9757))
    conn = lambda room: websockets.connect(f'ws://localhost:9757/{room}')
    async with conn('t1') as w1, conn('t1') as w2:
        await w1.send(json.dumps({'username': 'Alice'}))

        await w2.send(json.dumps({'username': 'Bob'}))
        await w2.send(json.dumps({'message': 'Hello!'}))

        data = json.loads(await w1.recv())
        assert data['username'] == 'Bob'
        data = json.loads(await w1.recv())
        assert data['message'] == 'Hello!'
    task.cancel()
