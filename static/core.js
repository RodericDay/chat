async function createWebSocket(username) {
    State.username = username
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
        audio: { echoCancellation: true },
        video: { width: { ideal: 320 }, facingMode: 'user', frameRate: 26 }
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
    rpc.onnegotiationneeded = async () => {
        await rpc.setLocalDescription()
        State.myWs.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
    }
    rpc.onicecandidate = ({ candidate }) => {
        State.myWs.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
    }
    rpc.ontrack = ({ track, streams }) => {
        // overloading meaning: if stream is specified, assume it is not the generic stream
        if (streams.length) {
            State.sharedScreen = streams[0]
        } else {
            peer.stream.addTrack(track)
        }
    }
    rpc.ondatachannel = ({ channel }) => {
        const fileTransfer = new FileTransfer(channel.label)
        peer.fileTransfers.push(fileTransfer)
        channel.binaryType = 'arraybuffer'
        channel.onmessage = ({ target, data }) => onFileData(target, fileTransfer, data)
    }

    const peer = Object.seal({
        username,
        rpc,
        polite,
        stream: new MediaStream(),
        fileTransfers: [],
    })
    return peer
}

function FileTransfer(label) {
    const { name, size, type } = JSON.parse(label)
    return {
        name,
        size,
        type,
        buffer: [],
        get curSize() { return this.buffer.reduce((a, b) => a + b.byteLength, 0) },
        render() { return `${this.name} (${this.curSize}/${this.size})` },
    }
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
    State.myStream.getTracks().forEach(track => State.peers[username].rpc.addTrack(track))
    if (State.sharedScreenIsLocal) {
        State.sharedScreen.getTracks().forEach(track => State.peers[username].rpc.addTrack(track, State.sharedScreen))
    }
}

async function wspeer({ sender }) {
    State.peers[sender] = await createPeer(sender, true)
    State.myStream.getTracks().forEach(track => State.peers[sender].rpc.addTrack(track))
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

function wspost(post) {
    State.posts.push(post)
}

const doFileUpload = async (file) => {
    const buffer = await file.arrayBuffer()
    Object.values(State.peers).forEach(async ({ rpc, fileTransfers }) => {
        const label = JSON.stringify({ name: file.name, type: file.type, size: buffer.byteLength })
        const fileTransfer = new FileTransfer(label)
        fileTransfers.push(fileTransfer)
        const dc = await rpc.createDataChannel(label)
        dc.onopen = async () => {
            const step = rpc.sctp.maxMessageSize
            let ptr = 0
            while ( ptr < buffer.byteLength ) {
                const data = buffer.slice(ptr, ptr + step)
                await dc.send(data)
                onFileData(dc, fileTransfer, data)
                ptr += step
            }
        }
    })
}

const onFileData = (channel, fileTransfer, data) => {
    fileTransfer.buffer.push(data)
    if (fileTransfer.size === fileTransfer.curSize) {
        const file = new File(fileTransfer.buffer, fileTransfer.name, { type: fileTransfer.type })
        onFullFile(file)
    }
    m.redraw()
}

const onFullFile = (file) => {
    const blobUrl = URL.createObjectURL(file)
    State.posts.push({ sender: 'server', text: `[${ file.name }](${ blobUrl })` })
}

const startSharingScreen = async () => {
    State.sharedScreen = await navigator.mediaDevices.getDisplayMedia()
    State.sharedScreen.getTracks().forEach(track => Object.values(State.peers).forEach(({ rpc }) => rpc.addTrack(track, State.sharedScreen)))
}

const stopSharingScreen = () => {
    State.myWs.send(JSON.stringify({ kind: 'stopscreen' }))
}

const wsstopscreen = () => {
    State.sharedScreen.getTracks().forEach(track => track.stop())
    State.sharedScreen = null
}

export { createWebSocket, startMyStream, doFileUpload, startSharingScreen, stopSharingScreen }
