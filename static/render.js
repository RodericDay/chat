const renderWebsocket = (ws) => {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN']
    return states[ws.readyState || 4]
}

function renderStreams(State) {
    const entries = Object.entries(State.streams)
        .filter(([k, v]) => v.active)
        .map(([k, v]) => [k, Object.fromEntries(v.getTracks().map(({ kind, readyState }) => [kind, readyState]))])
    return Object.fromEntries(entries)
}

function renderRPCs(State) {
    const entries = Object.entries(State.rpcs)
        .filter(([k, v]) => !['closed', 'failed'].includes(v.connectionState))
        .map(([k, v]) => [k, [v.connectionState, v.iceConnectionState, v.iceGatheringState, v.signalingState].join(', ')])
    return Object.fromEntries(entries)
}

function diff(aa, bb) {
    const cc = [...new Set([...aa, ...bb])]
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

function renderVideos(State) {
    const aa = [...document.querySelectorAll('video')].map(el => el.id)
    const bb = Object.entries(State.streams).filter(([k, v]) => v.active).map(([k, v]) => k)
    const [total, additions, deletions] = diff(aa, bb)

    for (const id of additions) {
        let video = document.createElement('video')
        video.id = id
        video.setAttribute('playsinline', '')
        video.setAttribute('autoplay', '')
        video.srcObject = State.streams[id]
        video.muted = id === State.myUid
        video.classList.toggle('mirrored', id === State.myUid)
        videos.appendChild(video)
    }
    for (const id of total) {
        let video = document.getElementById(id)
        video.style.objectFit = State.settings.bars ? 'contain' : 'cover'
    }
    for (const id of deletions) {
        let video = document.getElementById(id)
        video.parentNode.removeChild(video)
    }

    reFlow(videos)
}

function renderPosts(State) {
    const strings = State.posts.map(post => {
        if (post.url) {
            return `${post.sender}: <a target="_blank" href="${post.url}" filename="${post.filename}">${post.filename}</a>`
        } else {
            return `${post.sender}: ${post.text}`
        }
    })
    messages.innerHTML = strings.join('\n')  // unsafe, but needed until we figure out blob URLs
}

const renderAll = (State) => () => {
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

    renderVideos(State)
    renderPosts(State)

    const toRender = {}
    toRender.ws = State.ws && renderWebsocket(State.ws)
    toRender.websockets = Object.fromEntries(Object.entries(State.websockets).map(([k, v]) => [k, renderWebsocket(v)]))
    toRender.streams = renderStreams(State)
    toRender.rpcs = renderRPCs(State)
    toRender.buffer = State.buffer.length
    toRender.local = localStorage
    debug.textContent = JSON.stringify(toRender, null, 2)

}

export { renderAll }
