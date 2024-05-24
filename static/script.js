const State = Object.seal({
    websockets: {},
    ws: null,
    username: '',
    myUid: null,
    settings: {},
    users: {},
    posts: [],
    errors: [],
    streams: {},
    rpcs: {},
    buffer: [],
})

const renderWebsocket = (ws) => {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN']
    return states[ws.readyState || 4]
}

const renderStreams = () => {
    const entries = Object.entries(State.streams)
        .filter(([k, v]) => v.active)
        .map(([k, v]) => [k, Object.fromEntries(v.getTracks().map(({ kind, readyState }) => [kind, readyState]))])
    return Object.fromEntries(entries)
}

const renderRPCs = () => {
    const entries = Object.entries(State.rpcs)
        .filter(([k, v]) => !['closed', 'failed'].includes(v.connectionState))
        .map(([k, v]) => [k, [v.connectionState, v.iceConnectionState, v.iceGatheringState, v.signalingState].join(', ')])
    return Object.fromEntries(entries)
}

function diff(aa, bb) {
    cc = [...new Set([...aa, ...bb])]
    return [cc, cc.filter(x => !aa.includes(x)), cc.filter(x => !bb.includes(x))]
}

function reFlow(videos) {
    const N = videos.childNodes.length
    let [X, Y] = [1, 1]
    while (N > X * Y) {
        if (X % 2 === Y % 2) {
            X += 1
        } else {
            Y += 1
        }
    }
    const { width, height } = videos.getBoundingClientRect()
    if (height / width > 3 / 4) {
        [X, Y] = [Y, X]
    }
    videos.style.gridTemplateColumns = Array(X).fill('1fr').join(' ')
    videos.style.gridTemplateRows = Array(Y).fill('1fr').join(' ')
}

function renderVideos() {
    const aa = [...document.querySelectorAll('video')].map(el => el.id)
    const bb = Object.entries(State.streams).filter(([k, v]) => v.active).map(([k, v]) => k)
    const [total, additions, deletions] = diff(aa, bb)

    for (id of additions) {
        let video = document.createElement('video')
        video.id = id
        video.setAttribute('playsinline', '')
        video.setAttribute('autoplay', '')
        video.srcObject = State.streams[id]
        video.muted = id === State.myUid
        video.classList.toggle('mirrored', id === State.myUid)
        videos.appendChild(video)
    }
    for (id of total) {
        let video = document.getElementById(id)
        video.style.objectFit = State.settings.bars ? 'contain' : 'cover'
    }
    for (id of deletions) {
        let video = document.getElementById(id)
        video.parentNode.removeChild(video)
    }

    reFlow(videos)
}

function renderPosts() {
    strings = State.posts.map(post => {
        if (post.url) {
            return `${post.sender}: <a target="_blank" href="${post.url}" filename="${post.filename}">${post.filename}</a>`
        } else {
            return `${post.sender}: ${post.text}`
        }
    })
    messages.innerHTML = strings.join('\n')  // unsafe, but needed until we figure out blob URLs
}

setInterval(() => {

    const count = Object.keys(State.users).length
    document.title = 'Lab' + (count ? ` (${count})` : '')

    loginForm.hidden = !!State.username
    usernameDisplay.textContent = State.username
    logoutForm.hidden = !State.username
    userSettings.hidden = !State.username
    chat.style.visibility = (State.username && State.settings.chat) ? 'unset' : 'hidden'
    debug.style.visibility = State.settings.debug ? 'unset' : 'hidden'

    userSettings.audio.checked = localStorage.getItem('audio') !== 'false'
    userSettings.video.checked = localStorage.getItem('video') !== 'false'
    userSettings.bars.checked = localStorage.getItem('bars') !== 'false'
    userSettings.chat.checked = localStorage.getItem('chat') === 'true'
    userSettings.debug.checked = localStorage.getItem('debug') === 'true'

    renderVideos()
    renderPosts()

    toRender = {}
    toRender.ws = State.ws && renderWebsocket(State.ws)
    toRender.websockets = Object.fromEntries(Object.entries(State.websockets).map(([k, v]) => [k, renderWebsocket(v)]))
    toRender.streams = renderStreams()
    toRender.rpcs = renderRPCs()
    toRender.buffer = State.buffer.length
    toRender.local = localStorage
    debug.textContent = JSON.stringify(toRender, null, 2)

}, 200)

function createWebSocket(url, username) {
    'use strict'
    const uid = crypto.randomUUID()
    const ws = new ReconnectingWebSocket(url)
    ws.onopen = () => {
        ws.send(JSON.stringify({ kind: 'login', username }))
    }
    ws.onclose = () => {
        delete State.websockets[uid]
        State.ws = Object.values(State.websockets)[0]
    }
    ws.onmessage = ({data}) => {
        try {
            data = JSON.parse(data)
        } catch(error) {
            data = { kind: 'error', error, data }
            ws.close()
        }
        const handler = window['ws' + data.kind] || console.log
        handler(data)
    }
    State.websockets[uid] = ws
    return ws
}

loginForm.onsubmit = async (e) => {
    e?.preventDefault()
    const username = loginForm.username.value
    localStorage.setItem('username', username)
    State.username = username

    await startMyStream()

    const url = location.href.replace('http', 'ws')
    State.ws = createWebSocket(url, username)
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
    userSettings.onchange()
}

async function createRpcConnection(username) {
    'use strict'
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

async function wsleave({ username }) {
    const uid = State.users[username]?.uid
    State.rpcs[uid]?.close()
    delete State.users[username]
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

logoutForm.onsubmit = (e) => {
    e?.preventDefault()
    State.ws.close()
    State.streams[State.myUid].getTracks().map(track => track.stop())
    Object.values(State.rpcs).forEach(rpc => rpc.close())
    State.username = ''
    State.myUid = ''
    localStorage.removeItem('username')
}

messageForm.onsubmit = (e) => {
    e?.preventDefault()
    if (!messageForm.message.value) return
    State.ws?.send(JSON.stringify({ kind: 'post', text: messageForm.message.value }))
    messageForm.message.value = ''
}

messageForm.onpaste = (event) => {
    items = [...event.clipboardData.items].filter(item => !item.type.includes('text/'))
    for(const item of items) {
        const file = item.getAsFile()
        doFileUpload(file)
        return false
    }
}

fileInput.oninput = (e) => {
    [...e.target.files].forEach(doFileUpload)
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

function wspost(data) {
    State.posts.unshift(data)
}

userSettings.onchange = () => {
    State.settings = {
        audio: userSettings.audio.checked,
        video: userSettings.video.checked,
        bars: userSettings.bars.checked,
        chat: userSettings.chat.checked,
        debug: userSettings.debug.checked,
    }
    // update localStorage
    Object.entries(State.settings).map(([key, value]) => localStorage.setItem(key, value))
    // update stream
    State.streams[State.myUid].getTracks().forEach(track => {
        track.enabled = State.settings[track.kind]
    })
}

function wserror(data) {
    State.errors.unshift(data)
}

const known = localStorage.getItem('username')
if (known) {
    loginForm.username.value = known
    loginForm.onsubmit()
}
