const State = Object.seal({
    websockets: {},
    ws: null,
    username: '',
    streamId: null,
    users: {},
    posts: [],
    errors: [],
    version: null,
    streams: {},
    rpcs: {},
})

const renderWebsocket = (ws) => {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN']
    return states[ws.readyState || 4]
}

const renderStream = (stream) => {
    return stream.getTracks().map(track => track.kind).join(', ')
}

const renderRPC = (rpc) => {
    return rpc.connectionState
}

function diff(aa, bb) {
    cc = [...new Set([...aa, ...bb])]
    return [cc.filter(x => !aa.includes(x)), cc.filter(x => !bb.includes(x))]
}

const renderVideos = () => {
    const aa = [...document.querySelectorAll('video')].map(el => el.id)
    const bb = Object.keys(State.streams)
    const [additions, deletions] = diff(aa, bb)

    for (id of additions) {
        let video = document.createElement('video')
        video.srcObject = State.streams[id]
        video.id = id
        video.play()
        video.muted = id === State.streamId
        video.classList.toggle('mirrored', id === State.streamId)
        videos.appendChild(video)
    }
    for (id of deletions) {
        let video = document.getElementById(id)
        video.parentNode.removeChild(video)
    }
}

setInterval(async () => {
    const count = Object.keys(State.users).length
    document.title = 'Lab' + (count ? ` (${count})` : '')
    toRender = { ...State }
    toRender.ws = State.ws && renderWebsocket(State.ws)
    toRender.websockets = Object.fromEntries(Object.entries(State.websockets).map(([k, v]) => [k, renderWebsocket(v)]))
    toRender.streams = Object.fromEntries(Object.entries(State.streams).map(([k, v]) =>[k, renderStream(v)]))
    toRender.rpcs = Object.fromEntries(Object.entries(State.rpcs).map(([k, v]) =>[k, renderRPC(v)]))
    renderVideos()
    debug.textContent = JSON.stringify(toRender, null, 2)
}, 100)

function MyWebSocket(url, username) {
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
        const handler = window['my' + data.kind] || console.log
        handler(data)
    }
    State.websockets[uid] = ws
    return ws
}

loginForm.onsubmit = (e) => {
    e?.preventDefault()
    localStorage.setItem('username', loginForm.username.value)
    const url = location.href.replace('http', 'ws')
    State.ws = new MyWebSocket(url, loginForm.username.value)
}

logoutForm.onsubmit = (e) => {
    e?.preventDefault()
    Object.entries(State.streams).map(([uid, stream]) => {
        stream.getTracks().map(track => track.stop())
        delete State.streams[uid]
    })
    State.users = {}
    localStorage.removeItem('username')
    State.ws?.send(JSON.stringify({ kind: 'logout' }))
}

messageForm.onsubmit = (e) => {
    e?.preventDefault()
    State.ws?.send(JSON.stringify({ kind: 'post', text: messageForm.message.value }))
}

userSettings.onchange = ({ targets }) => {
    const settings = {
        audio: userSettings.audio.checked,
        video: userSettings.video.checked,
        bars: userSettings.bars.checked,
    }
    // update local
    Object.entries(settings).map(([key, value]) => localStorage.setItem(key, value))
    // share
    State.ws.send(JSON.stringify({ kind: 'settings', settings, targets }))
}

async function mylogin({ username }) {
    State.username = username
    userSettings.audio.checked = localStorage.getItem('audio') !== 'false'
    userSettings.video.checked = localStorage.getItem('video') !== 'false'
    userSettings.bars.checked = localStorage.getItem('bars') !== 'false'
    userSettings.onchange({})

    const uid = crypto.randomUUID()
    const config = {
        audio: true,
        video: {width: {ideal: 320}, facingMode: 'user', frameRate: 26}
    }
    const stream = await navigator.mediaDevices.getUserMedia(config)
    State.streams[uid] = stream
    State.streamId = uid
}

function mysettings({ sender, settings }) {
    if (State.users[sender]) {
        Object.assign(State.users[sender], settings)
    }
}

function myversion({ version }) {
    if (State.version && State.version !== version) {
        location.reload()
    }
    else {
        State.version = version
    }
}

function myerror(data) {
    State.errors.unshift(data)
}

function mypost(data) {
    State.posts.unshift(data)
}

function myusers({ users }) {
    const [additions, deletions] = diff(Object.keys(State.users), users)
    for (user of additions) {
        State.users[user] = {}
        userSettings.onchange({ targets: [user] })
        if (user !== State.username) {
            rpcConnect(user)
        }
    }
    for (user of deletions) {
        delete State.users[user]
    }
}

function mylogout() {
    State.ws.close()
}

if (localStorage.getItem('username')) {
    loginForm.username.value = localStorage.getItem('username')
    loginForm.onsubmit()
}

async function myoffer({ sender, offer }) {
    const rpc = State.rpcs[sender]
    await rpc.setRemoteDescription(offer)
    const answer = await rpc.createAnswer()
    await rpc.setLocalDescription(answer)
    State.ws.send(JSON.stringify({ kind: 'answer', targets: [sender], answer: rpc.localDescription }))
}

async function myanswer({ sender, answer }) {
    const rpc = State.rpcs[sender]
    await rpc.setRemoteDescription(answer)
}

async function rpcConnect(user) {
    const config = {}
    const rpc = new RTCPeerConnection(config)
    const stream = new MediaStream()
    rpc.onnegotiationneeded = async (e) => {
        await rpc.setLocalDescription()
        State.ws.send(JSON.stringify({ kind: 'offer', targets: [user], offer: rpc.localDescription }))
    }
    rpc.onaddtrack = (e) => {
        stream.addTrack(e.track)
    }
    State.streams[user] = stream
    State.rpcs[user] = rpc
    setTimeout(() => State.streams[State.streamId].getTracks().map((track) => rpc.addTrack(track)), 1000)
}
