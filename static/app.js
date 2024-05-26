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
        State.myWs.close()
    },
    logIn: async (e) => {
        e.preventDefault()
        await core.startMyStream()
        await core.createWebSocket(e.target.username.value)
        State.myWs.addEventListener('open', m.redraw)
        State.myWs.addEventListener('message', m.redraw)
        State.myWs.addEventListener('close', m.redraw)
    },
    view: () => State.myWs
    ? m('form#logoutForm', { onsubmit: Login.logOut },
        m('span', State.username),
        m('button', 'log out'),
    )
    : m('form#loginForm', { onsubmit: Login.logIn },
        m('input[name=username][autocomplete=off]', { value: State.username }),
        m('button', 'log in'),
    ),
}

const CheckBox = {
    onChange(event) {
        State[this.name] = this.checked
    },
    view({ attrs: { name } }) {
        return m('label',
            m('input[type=checkbox]', { name, checked: State[name], onchange: this.onChange }),
            name,
        )
    },
}

const Settings = {
    getScreen: async () => {
        const stream = await navigator.mediaDevices.getDisplayMedia()
        State.myWs.send(JSON.stringify({ kind: 'screen', screenId: stream.id }))
        Object.values(State.peers).map(peer => stream.getTracks().map(track => peer.rpc.addTrack(track, stream)))
    },
    stopScreen: () => {
        State.myWs.send(JSON.stringify({ kind: 'screen', streamId: null }))
    },
    apply: (e) => {
        if (State.myStream) {
            State.myStream.getTracks().forEach(track => { track.enabled = State[track.kind] })
        }
    },
    view() {
        return State.myWs && m('div', { oncreate: this.apply, onupdate: this.apply },
            ['audio', 'video', 'bars', 'chat', 'debug'].map(name => m(CheckBox, { name })),
            // State.streamId
            // ? m('button', { onclick: this.stopScreen }, 'stop screenshare')
            // : m('button', { onclick: this.getScreen }, 'start screenshare'),
        )
    },
}

const Nav = {
    view: () => m('nav', m(Login), m(Settings))
}

const Video = {
    oncreate: ({ attrs, dom }) => {
        dom.autoplay = true
        dom.muted = attrs.self === true
        dom.classList.toggle('mirrored', attrs.self === true)
        dom.srcObject = attrs.stream
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
        State.myStream && m(Video, { self: true, stream: State.myStream }),
        Object.values(State.peers)
            .map(peer => peer.stream && m(Video, { key: peer.stream.id, stream: peer.stream }))
    )
}

const Upload = {
    view: ({ attrs }) => m('.upload',
        attrs.finalSize
        ? m('div',
            m('div', attrs.name),
            m('progress', { max: attrs.finalSize, value: attrs.size }),
        )
        : m('a', { target: '_blank', oncreate: ({ dom }) => { dom.href = URL.createObjectURL(attrs) } }, attrs.name),
    ),
}

const Post = {
    view: ({ attrs }) => m('.post', m('b.sender', attrs.sender + ': '), attrs.url
        ? m('a', { target: '_blank', href: attrs.url }, attrs.filename)
        : m('span.text', attrs.text)
    ),
}

const Chat = {
    onPaste: ({ clipboardData }) => {
        const items = [...clipboardData.items].filter(item => !item.type.includes('text/'))
        for(const item of items) {
            const file = item.getAsFile()
            core.doFileUpload(file)
            return false // don't leave string behind on input field
        }
    },
    onInput: (e) => {
        [...e.target.files].forEach(core.doFileUpload)
    },
    onSubmit(e) {
        e.preventDefault()
        if (this.message.value) {
            State.myWs?.send(JSON.stringify({ kind: 'post', text: this.message.value }))
            this.message.value = ''
        }
    },
    view() {
        return State.myWs && State.chat && m('#chat',
            m('form#messageForm', { onsubmit: this.onSubmit },
                m('input[name=message][autocomplete=off]', { onpaste: this.onPaste }),
                m('button', 'post'),
                m('label', '📎',
                    m('input#fileInput[type=file][hidden]', { oninput: this.onInput })
                ),
            ),
            m('#messages',
                Object.values(State.uploads).map(upload => m(Upload, upload)),
                State.posts.map(post => m(Post, post)),
            )
        )
    }
}

const Debug = {
    view: () => {
        const renderStream = (stream) => {
            return stream?.getTracks()
                .map(track => track.kind)
                .join(', ')
        }
        const renderRpc = (rpc) => ({
            connectionState: rpc.connectionState,
            iceConnectionState: rpc.iceConnectionState,
            iceGatheringState: rpc.iceGatheringState,
            signalingState: rpc.signalingState,
        })
        const toRender = {
            myWs: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', null][State.myWs?.readyState || 4],
            myStream: renderStream(State.myStream),
            peers: Object.values(State.peers).map(peer => ({
                username: peer.username,
                rpc: renderRpc(peer.rpc),
                stream: renderStream(peer.stream),
            })),
            uploads: Object.values(State.uploads).map(({ name, size, type }) => ({ name, size, type })),
        }
        return State.debug && m('#debug', JSON.stringify(toRender, null, 2))
    }
}

const App = {
    view: () => [m(Nav), m(Videos), m(Chat), m(Debug)]
}

m.mount(document.body, App)
setInterval(m.redraw, 1000)
