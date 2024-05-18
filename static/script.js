const State = Object.seal({
    mws: null,
    username: '',
    users: [],
    posts: [],
    errors: [],
    version: null,
})
const StateDefaults = JSON.parse(JSON.stringify(State))
delete StateDefaults.errors
delete StateDefaults.posts

setInterval(async () => {
    document.title = 'Lab' + (State.users.length ? ` (${ State.users.length })` : '')
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
    State.users = users
}

function mylogout() {
    State.mws.close()
}

if (localStorage.getItem('username')) {
    loginForm.username.value = localStorage.getItem('username')
    loginForm.onsubmit()
}
