const State = Object.seal({
    ws: null,
    username: '',
    users: {},
    posts: [],
    errors: [],
    version: null,
})
const StateDefaults = JSON.parse(JSON.stringify(State))
delete StateDefaults.errors
delete StateDefaults.posts

setInterval(async () => {
    const count = Object.keys(State.users).length
    document.title = 'Lab' + (count ? ` (${count})` : '')
    toRender = { ...State }
    toRender.posts = [...toRender.posts].reverse()
    toRender.ws = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN'][State.ws?.readyState || 4]
    debug.textContent = JSON.stringify(toRender, null, 2)
}, 100)

function MyWebSocket(url, username) {
    const ws = new ReconnectingWebSocket(url)
    ws.onopen = () => {
        ws.send(JSON.stringify({ kind: 'login', username }))
    }
    ws.onclose = () => {
        Object.assign(State, JSON.parse(JSON.stringify(StateDefaults)))
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
    return ws
}

loginForm.onsubmit = (e) => {
    e?.preventDefault()
    if (State.ws) return
    localStorage.setItem('username', loginForm.username.value)
    const url = location.href.replace('http', 'ws')
    const ws = new MyWebSocket(url, loginForm.username.value)
    Object.assign(State, { ws: ws })
}

logoutForm.onsubmit = (e) => {
    e?.preventDefault()
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
        mirror: userSettings.mirror.checked,
        bars: userSettings.bars.checked,
    }
    // update local
    Object.entries(settings).map(([key, value]) => localStorage.setItem(key, value))
    // share
    State.ws.send(JSON.stringify({ kind: 'settings', settings, targets }))
}

function mylogin({ username }) {
    State.username = username
    userSettings.audio.checked = localStorage.getItem('audio') !== 'false'
    userSettings.video.checked = localStorage.getItem('video') !== 'false'
    userSettings.mirror.checked = localStorage.getItem('mirror') !== 'false'
    userSettings.bars.checked = localStorage.getItem('bars') !== 'false'
    userSettings.onchange({})
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
    State.errors.push(data)
}

function mypost(data) {
    State.posts.push(data)
}

function myusers({ users }) {
    for (user of new Set([...Object.keys(State.users), ...users])) {
        if (!State.users[user]) {
            State.users[user] = {}
            userSettings.onchange({ targets: [user] })
        }
        else if (!users.includes(user)) {
            delete State.users[user]
        }
    }
}

function mylogout() {
    State.ws.close()
}

if (localStorage.getItem('username')) {
    loginForm.username.value = localStorage.getItem('username')
    loginForm.onsubmit()
}
