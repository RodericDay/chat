const State = Object.seal({
    mws: null,
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
    toRender.mws = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN'][State.mws?.readyState || 4]
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
    if (State.mws) return
    localStorage.setItem('username', loginForm.username.value)
    const url = location.href.replace('http', 'ws')
    const mws = new MyWebSocket(url, loginForm.username.value)
    Object.assign(State, { mws: mws })
}

logoutForm.onsubmit = (e) => {
    e?.preventDefault()
    localStorage.removeItem('username')
    State.mws?.send(JSON.stringify({ kind: 'logout' }))
}

messageForm.onsubmit = (e) => {
    e?.preventDefault()
    State.mws?.send(JSON.stringify({ kind: 'post', text: messageForm.message.value }))
}

userSettings.onchange = (e) => {
    const settings = {
        audio: userSettings.audio.checked,
        video: userSettings.video.checked,
    }
    Object.entries(settings).map(([key, value]) => localStorage.setItem(key, value))
    console.log(settings)
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
        }
        else if (!users.includes(user)) {
            delete State.users[user]
        }
    }
}

function mylogout() {
    State.mws.close()
}

if (localStorage.getItem('username')) {
    loginForm.username.value = localStorage.getItem('username')
    userSettings.audio.checked = localStorage.getItem('audio') !== 'false'
    userSettings.video.checked = localStorage.getItem('video') !== 'false'
    loginForm.onsubmit()
}
