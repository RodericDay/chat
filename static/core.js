async function createWebSocket(username) {
    await startMyStream()
    const url = location.href.replace('http', 'ws')
    const uid = crypto.randomUUID()
    const ws = new WebSocket(url)
    ws.onopen = async () => {
        State.username = username
        ws.send(JSON.stringify({ kind: 'login', username }))
    }
    ws.onclose = () => {
        delete State.websockets[uid]
        State.ws = Object.values(State.websockets)[0]

        if (!State.ws) {
            State.streams[State.myUid].getTracks().forEach(track => track.stop())
            State.streams = {}

            Object.values(State.rpcs).map(rpc => rpc.close())
            State.rpcs = {}

            State.myUid = null
        }
    }
    ws.onmessage = ({data}) => {
        try {
            data = JSON.parse(data)
        } catch(error) {
            data = { kind: 'error', error, data }
            ws.close()
        }
        let handler
        try {
            handler = eval('ws' + data.kind)
        } catch {
            handler = console.log
        }
        handler(data)
    }
    State.websockets[uid] = ws
    return ws
}

async function startMyStream() {
    const uid = crypto.randomUUID()
    const config = {
        audio: true,
        video: {width: {ideal: 320}, facingMode: 'user', frameRate: 26}
    }
    const stream = await navigator.mediaDevices.getUserMedia(config)
    State.streams[uid] = stream
    State.myUid = uid
}

async function createRpcConnection(username) {
    const uid = crypto.randomUUID()
    State.users[username] = { uid }
    // test -- https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
    const config = {
        iceServers: [
            {
                urls: [`stun:165.227.36.123:5349`, `turn:165.227.36.123:5349`],
                username: 'roderic',
                credential: 'tomodachi',
            },
        ],
    }
    const rpc = new RTCPeerConnection(config)
    State.rpcs[uid] = rpc

    const stream = new MediaStream()
    State.streams[uid] = stream
    rpc.ontrack = (e) => {
        stream.addTrack(e.track)
    }
    rpc.onicecandidate = ({ candidate }) => {
        State.ws.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
    }
    rpc.ondatachannel = ({ channel }) => {
        rpc.dc = channel
        rpc.dc.binaryType = 'arraybuffer'
        rpc.dc.onmessage = onFileData(username)
    }

    const myStream = State.streams[State.myUid]
    myStream.getTracks().forEach(async (track) => { await rpc.addTrack(track) })

    return rpc
}

async function wsicecandidate({ sender, candidate }) {
    await State.rpcs[State.users[sender].uid].addIceCandidate(candidate)
}

async function wsenter({ username }) {
    const rpc = await createRpcConnection(username)
    rpc.dc = await rpc.createDataChannel('data')
    rpc.dc.binaryType = 'arraybuffer'

    rpc.dc.onmessage = onFileData(username)
    await rpc.setLocalDescription()
    State.ws.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
}

async function wsoffer({ sender, offer }) {
    const rpc = await createRpcConnection(sender)
    await rpc.setRemoteDescription(offer)

    const answer = await rpc.createAnswer()
    await rpc.setLocalDescription(answer)
    State.ws.send(JSON.stringify({ kind: 'answer', targets: [sender], answer: rpc.localDescription }))
}

async function wsanswer({ sender, answer }) {
    const rpc = State.rpcs[State.users[sender].uid]
    await rpc.setRemoteDescription(answer)
}

async function wsleave({ username }) {
    const uid = State.users[username]?.uid
    State.rpcs[uid]?.close()
    delete State.rpcs[uid]
    delete State.streams[uid]
    delete State.users[username]
}

function wspost(post) {
    State.posts.unshift(post)
}

const doFileUpload = async (file) => {
    const buffer = await file.arrayBuffer()
    Object.values(State.rpcs).forEach(async (rpc) => {
        const step = rpc.sctp.maxMessageSize
        let ptr = 0
        while ( ptr < buffer.byteLength ) {
            await rpc.dc.send(buffer.slice(ptr, ptr + step))
            ptr += step
        }
        await rpc.dc.send(JSON.stringify({ filename: file.name, filetype: file.type }))
    })
    onFileData(State.username)({ data: buffer })
    onFileMetaData(State.username, file.name, file.type)
}

const onFileData = (sender) => async ({ data }) => {
    try {
        const { filename, filetype } = JSON.parse(data)
        onFileMetaData(sender, filename, filetype)
    } catch(error) {
        State.buffer.push(data)
    }
}

const onFileMetaData = (sender, filename, filetype) => {
    const obj = new File(State.buffer, filename, { type: filetype })
    State.buffer = []
    const url = URL.createObjectURL(obj)
    State.posts.unshift({ sender, url, filename })
}

export { createWebSocket, doFileUpload }
