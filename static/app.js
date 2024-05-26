import * as core from '/core.js'

const Login = {
    oncreate: (e) => {
        // maybe auto-login
        if (State.username) {
            e.dom.username.value = State.username
            Login.logIn({ preventDefault: () => {}, target: e.dom })
        }
    },
    logOut: (e) => {
        e.preventDefault()
        State.ws.close()

        State.streams[State.myUid].getTracks().forEach(track => track.stop())
        State.streams = {}

        Object.values(State.rpcs).map(rpc => rpc.close())
        State.rpcs = {}

        State.myUid = null
    },
    logIn: async (e) => {
        e.preventDefault()
        await core.startMyStream()
        State.ws = core.createWebSocket(e.target.username.value)
        State.ws.addEventListener('open', m.redraw)
        State.ws.addEventListener('message', m.redraw)
        State.ws.addEventListener('close', m.redraw)
    },
    view: () => State.ws
    ? m('form#logoutForm', { onsubmit: Login.logOut },
        m('span', State.username),
        m('button', 'log out'),
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN'][State.ws.readyState || 4],
    )
    : m('form#loginForm', { onsubmit: Login.logIn },
        m('input[name=username][autocomplete=off]', { value: State.username }),
        m('button', 'log in'),
    ),
}

const Settings = {
    apply: (e) => {
        const myStream = State.streams[State.myUid]
        if (myStream) {
            myStream.getTracks().forEach(track => { track.enabled = State[track.kind] })
        }
    },
    onchange: ({ target }) => {
        ['audio', 'video', 'bars', 'chat', 'debug'].forEach(name => {
            State[name] = target.form[name].checked
        })
    },
    view: () => State.ws && m('form', { onchange: Settings.onchange, oncreate: Settings.apply, onupdate: Settings.apply },
        ['audio', 'video', 'bars', 'chat', 'debug'].map(name =>
            m('label', m('input[type=checkbox]', { name, checked: State[name] }), name),
        )
    ),
}

const Nav = {
    view: () => m('nav', m(Login), m(Settings))
}

const Video = {
    oncreate: ({ attrs, dom }) => {
        dom.autoplay = true
        dom.muted = attrs.uid === State.myUid
        dom.classList.toggle('mirrored', attrs.uid === State.myUid)
        dom.srcObject = State.streams[attrs.uid]
    },
    view: () => m('video[playsinline]', { style: { objectFit: State.bars ? 'contain' : 'cover' } })
}

const Videos = {
    reFlow: ({ dom }) => {
        const N = dom.childNodes.length
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
        dom.style.gridTemplateColumns = Array(X).fill('1fr').join(' ')
        dom.style.gridTemplateRows = Array(Y).fill('1fr').join(' ')
    },
    view: () => m('#videos', { oncreate: Videos.reFlow, onupdate: Videos.reFlow },
        Object.keys(State.streams).map(uid => m(Video, { key: uid, uid }))
    )
}

const Post = {
    view: ({ attrs }) => m('.post', m('b.sender', attrs.sender + ': '), attrs.url
        ? m('a', { target: '_blank', href: attrs.url }, attrs.filename)
        : m('span.text', attrs.text)
    ),
}

const Chat = {
    onPaste: ({ clipboardData }) => {
        items = [...clipboardData.items].filter(item => !item.type.includes('text/'))
        for(const item of items) {
            const file = item.getAsFile()
            core.doFileUpload(file)
        }
    },
    onInput: (e) => {
        [...e.target.files].forEach(core.doFileUpload)
    },
    onSubmit(e) {
        e.preventDefault()
        if (this.message.value) {
            State.ws?.send(JSON.stringify({ kind: 'post', text: this.message.value }))
            this.message.value = ''
        }
    },
    view() {
        return State.ws && State.chat && m('#chat',
            m('form#messageForm', { onsubmit: this.onSubmit },
                m('input[name=message][autocomplete=off]', { onpaste: this.onPaste }),
                m('button', 'post'),
                m('label', '📎',
                    m('input#fileInput[type=file][hidden]', { oninput: this.onInput })
                ),
            ),
            m('#messages', State.posts.map(post => m(Post, post)))
        )
    }
}

const Debug = {
    view: () => State.ws && State.debug && m('#debug', JSON.stringify(State, null, 2))
}

const App = {
    view: () => [m(Nav), m(Videos), m(Chat), m(Debug)]
}

m.mount(document.body, App)
