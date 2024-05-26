async function createWebSocket(username) {
    const url = location.href.replace('http', 'ws')
    const uid = crypto.randomUUID()
    const ws = new ReconnectingWebSocket(url)
    ws.onopen = async () => {
        ws.send(JSON.stringify({ kind: 'login', username }))
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
    State.myWs = ws
}

async function startMyStream() {
    const config = {
        audio: true,
        video: {width: {ideal: 320}, facingMode: 'user', frameRate: 26}
    }
    State.myStream = await navigator.mediaDevices.getUserMedia(config)
}

async function createPeer(username, polite) {
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
    rpc.ontrack = ({ track, streams }) => {
        for (const stream of streams) {
            if (stream.id === State.screenId) {
                State.screenStream = stream
            } else if (!peer.stream || peer.stream.id === stream.id) {
                peer.stream = stream
            } else {
                console.log('unknown', stream)
            }
        }
    }
    rpc.onicecandidate = ({ candidate }) => {
        State.myWs.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
    }
    rpc.ondatachannel = ({ channel }) => {
        channel.binaryType = 'arraybuffer'
        channel.onmessage = onFileData
    }
    rpc.onnegotiationneeded = async () => {
        await rpc.setLocalDescription()
        State.myWs.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
    }

    const peer = { username, rpc, polite }
    return peer
}

async function wsicecandidate({ sender, candidate }) {
    const { rpc } = State.peers[sender]
    if (rpc.remoteDescription) {
        await rpc.addIceCandidate(candidate)
    }
}

async function wsenter({ username }) {
    State.peers[username] = await createPeer(username, false)
    State.myWs.send(JSON.stringify({ kind: 'peer', targets: [username] }))
    State.myStream.getTracks().forEach(track => State.peers[username].rpc.addTrack(track, State.myStream))
}

async function wspeer({ sender }) {
    State.peers[sender] = await createPeer(sender, true)
    State.myStream.getTracks().forEach(track => State.peers[sender].rpc.addTrack(track, State.myStream))
}

async function wsoffer({ sender, offer }) {
    const { rpc, polite } = State.peers[sender]
    if (rpc.signalingState === 'stable') {
        await rpc.setRemoteDescription(offer)
    } else if (polite) {
        await Promise.all([
            rpc.setLocalDescription({ type: 'rollback' }),
            rpc.setRemoteDescription(offer),
        ])
    } else {
        return
    }

    await rpc.setLocalDescription(await rpc.createAnswer())
    State.myWs.send(JSON.stringify({ kind: 'answer', targets: [sender], answer: rpc.localDescription }))
}

async function wsanswer({ sender, answer }) {
    await State.peers[sender].rpc.setRemoteDescription(answer)
}

async function wsleave({ username }) {
    const { rpc, stream } = State.peers[username]
    rpc.close()
    stream.getTracks().forEach(track => track.stop())
    delete State.peers[username]
}

async function wsscreen({ screenId }) {
    State.screenId = screenId
}

function wspost(post) {
    State.posts.unshift(post)
}

const doFileUpload = async (file) => {
    const buffer = await file.arrayBuffer()
    Object.values(State.peers).forEach(async ({ rpc }) => {
        const meta = JSON.stringify({ name: file.name, type: file.type, size: buffer.byteLength })
        const dc = await rpc.createDataChannel(meta)
        const transmit = async () => {
            const step = rpc.sctp.maxMessageSize
            let ptr = 0
            while ( ptr < buffer.byteLength ) {
                await dc.send(buffer.slice(ptr, ptr + step))
                ptr += step
            }
        }
        setTimeout(transmit, 1000)
    })
    State.uploads[file.name] = file
}

const onFileData = ({ target, data }) => {
    const channel = target
    const { name, type, size } = JSON.parse(channel.label)

    if (!State.uploads[name]) {
        State.uploads[name] = { name, type, finalSize: size, buffer: [] }
    }

    const upload = State.uploads[name]
    upload.buffer.push(data)
    upload.size = upload.buffer.reduce((a, b) => a + b.byteLength, 0)
    if (upload.size == upload.finalSize) {
        State.uploads[name] = new File(upload.buffer, name, { type })
        channel.close()
    }
}

export { createWebSocket, startMyStream, doFileUpload }
