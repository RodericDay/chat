import * as core from '/core.js'

const Login = {
    oncreate({ dom }) {
        // maybe auto-login
        if (State.username) {
            dom.username.value = State.username
            Login.logIn({ preventDefault: () => {}, target: dom })
        }
    },
    logOut(e) {
        e.preventDefault()
        State.username = ''

        State.myWs?.close()
        State.myWs = undefined

        State.myStream?.getTracks().map(track => track.stop())
        State.myStream = undefined

        State.sharedScreen?.getTracks().map(track => track.stop())
        State.sharedScreen = undefined

        Object.values(State.peers).map(({ rpc, stream }) => {
            stream.getTracks().map(track => track.stop())
            rpc.close()
        })
        State.peers = {}
    },
    async logIn(e) {
        e.preventDefault()
        const username = e.target.username.value.trim()
        if (username) {
            await core.startMyStream()
            await core.createWebSocket(username)
            State.myWs.addEventListener('open', m.redraw)
            State.myWs.addEventListener('message', m.redraw)
            State.myWs.addEventListener('close', m.redraw)
        }
    },
    view() {
        const style = {
            height: '100%',
            border: '0',
            padding: '0 1em',
        }
        return m('form', { onsubmit: State.myWs ? this.logOut : this.logIn },
            m('button', { style }, State.myWs ? 'log out' : 'log in'),
            m('input[name=username][autocomplete=off][placeholder=username]', { style , disabled: !!State.myWs }),
        )
    }
}

const ToggleSetting = {
    toggle(name) {
        return (event) => { State[name] = !State[name] }
    },
    view({ attrs: { name, image, isOn, toggleFn } }) {
        isOn = isOn || State[name]
        toggleFn = toggleFn || this.toggle(name)
        const style = {
            height: '100%',
            filter: 'grayscale(1)',
            opacity: isOn ? 1 : 0.4,
        }
        return m('img', { onclick: toggleFn, src: image, alt: name, style })
    },
}

const Nav = {
    view() {
        const isOn = !!State.sharedScreen
        const toggleFn = isOn ? core.stopSharingScreen : core.startSharingScreen
        const style = {
            display: 'flex',
            width: '100dvw',
        }
        const spacer = m('.spacer', { style: { flex: 1 }})
        const loggedInOnly = []
        if (State.myWs) {
            loggedInOnly.push(
                m(ToggleSetting, { name: 'audio', image: '/svg/microphone.svg' }),
                m(ToggleSetting, { name: 'video', image: '/svg/camera.svg' }),
                m(ToggleSetting, { name: 'bars', image: '/svg/cards.svg' }),
                m(ToggleSetting, { name: 'chat', image: '/svg/chat.svg' }),
                m(ToggleSetting, { name: 'debug', image: '/svg/gear.svg' }),
                m(ToggleSetting, { name: 'screen', image: '/svg/screen.svg', isOn, toggleFn }),
            )
        }
        return m('nav', { style }, m(Login), spacer, ...loggedInOnly)
    }
}

const Video = {
    oncreate: ({ attrs, dom }) => {
        dom.muted = State.myStream.id === attrs.stream.id
        dom.autoplay = true
        dom.srcObject = attrs.stream
    },
    view: ({ attrs }) => {
        const style = {
            transform: State.myStream.id === attrs.stream.id ? 'scaleX(-1)' : 'scaleX(1)',
            width: '100%',
            height: '100%',
            objectFit: State.bars ? 'contain' : 'cover',
        }
        return m('video[playsinline]', { style })
    }
}

const VideoContainer = {
    view({ attrs }) {
        const muted = !attrs.stream.getAudioTracks().some(track => track.enabled)
        let info = `${ attrs.name } ${ muted ? '(muted)' : '' }`
        if (State.debug) {
            const debug = {
                name: attrs.name,
                id: attrs.stream.id,
                tracks: Object.fromEntries(attrs.stream.getTracks()
                    .filter(track => track.enabled)
                    .map(track => [track.label, track.kind])
                ),
            }
            if (attrs.ws) {
                debug.ws = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', null][attrs.ws.readyState || 4]
            }
            if (attrs.rpc) {
                debug.rpc = {
                    connectionState: attrs.rpc.connectionState,
                    iceConnectionState: attrs.rpc.iceConnectionState,
                    iceGatheringState: attrs.rpc.iceGatheringState,
                    signalingState: attrs.rpc.signalingState,
                }
            }
            if (attrs.fileTransfers) {
                debug.fileTransfers = attrs.fileTransfers.map(ft => ft.render())
            }
            info += '\n' + JSON.stringify(debug, null, 2)
        }
        const debugStyle = {
            position: 'absolute',
            top: 0,
            color: 'limegreen',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            transform: 'scaleX(1)',
            fontSize: 'x-small',
            whiteSpace: 'pre-wrap',
        }
        const style = {
            position: 'relative',
            overflow: 'hidden',
        }
        let isVisible = true
        if ( attrs.name === 'screen' ) {
            style.flex = 5
            style.overflow = 'scroll'
            if (State.sharedScreenIsLocal) {
                isVisible = false
            }
        }
        return m('.video-container', { style },
            isVisible && m(Video, { stream: attrs.stream }),
            m('pre', { style: debugStyle }, info),
        )
    },
}

const Videos = {
    reFlow: ({ dom }) => {
        const N = dom.childNodes.length
        const { width, height } = videos.getBoundingClientRect()
        let [X, Y, max] = [1, 1, 0]
        for (let x = 1; x <= N; x += 1) {
            for (let y = 1; y <= N; y += 1) {
                if (x * y >= N) {
                    const w = width / x
                    const h = height / y
                    const r = 3 / 5
                    const a = Math.min(w * w * r, h * h / r)
                    if (a > max) {
                        max = a
                        X = x
                        Y = y
                    }
                }
            }
        }
        dom.style.gridTemplateColumns = Array(X).fill('1fr').join(' ')
        dom.style.gridTemplateRows = Array(Y).fill('1fr').join(' ')
    },
    view: () => {
        const videos = []
        if(State.myStream) {
            videos.push({ name: State.username, stream: State.myStream, ws: State.myWs, })
        }
        for (const peer of Object.values(State.peers)) {
            videos.push({ name: peer.username, stream: peer.stream, rpc: peer.rpc, fileTransfers: peer.fileTransfers })
        }
        const style = {
            flex: 1,
            display: 'grid',
            overflow: 'hidden',
            backgroundColor: 'black',
        }
        const children = videos.map(attrs => m(VideoContainer, { key: attrs.stream.id, ...attrs }))
        return m('#videos', { style, oncreate: Videos.reFlow, onupdate: Videos.reFlow }, children)
    },
}

const Post = {
    mapping: new Map([
        [/-->/g, '→'],
        [/</g, '&lt;'],
        [/>/g, '&gt;'],
        [/\n+/g, `<br/>`],
        [/(\*.+\*)/g, (_, a) => `<b>${a}</b>`],
        [/(_.+_)/g, (_, a) => `<i>${a}</i>`],
        [/\[([^\]]+)\]\((blob:\S+?)\)/g, (_, a, b) => `<a target="blank_" href="${b}">${a}</a>`],
        [/\b(?<!blob:)(https?:\/\/\S+)\b/g, (_, a) => `<a target="blank_" href="${a}">${a}</a>`],
    ]),
    escape(string) {
        return [...this.mapping.entries()].reduce((string, [pattern, rep]) => string.replace(pattern, rep), string)
    },
    oncreate({ dom, attrs }) {
        const escaped = this.escape(attrs.text)
        dom.innerHTML = `<b>${ attrs.sender }</b>: ${ escaped }`
    },
    view({ attrs }) {
        return m('.post')
    },
}

const Chat = {
    maybeDismiss(event) {
        if (event.target === this) {
            State.chat = false
        }
    },
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
        const backgroundStyle = {
            position: 'fixed',
            left: 0,
            height: '100dvh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            width: '50dvw',
        }
        const foregroundStyle = {
            width: '50dvw', // coordinate with above
            overflow: 'scroll',
            backgroundColor: 'white',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
        }
        return [
            m('.chatBackground', { style: backgroundStyle, onclick: this.maybeDismiss }),
            m('.chatForeground', { style: foregroundStyle },
                m('form', { onsubmit: this.onSubmit },
                    m('input[name=message][autocomplete=off]', { onpaste: this.onPaste }),
                    m('button', 'post'),
                    m('label', '📎',
                        m('input[type=file][hidden]', { oninput: this.onInput })
                    ),
                ),
                m('#messages',
                    State.posts.map(post => m(Post, post)),
                ),
            ),
        ]
    }
}
