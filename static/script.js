const ws = new ReconnectingWebSocket(location.href.replace('http', 'ws'))

addEventListener('post', (e) => {
    const div = document.createElement('div')

    if (e.detail.sender) {
        const pre = document.createElement('b')
        pre.textContent = e.detail.sender + ': '
        div.appendChild(pre)
    }

    const text = document.createElement('span')
    text.textContent = e.detail.text
    div.appendChild(text)

    messages.appendChild(div)
})

addEventListener('count', (e) => {
    dispatchEvent(new CustomEvent('post', {detail: {text: `${e.detail.count} online`}}))
})

addEventListener('error', (e) => {
    const div = document.createElement('div')
    div.onclick = (e) => errors.removeChild(div)
    setTimeout(() => errors.removeChild(div), 2000)
    div.textContent = e.detail.text
    errors.appendChild(div)
})

ws.onopen = () => {
    ws.send(JSON.stringify({kind: 'login', username: 'roderic'}))
    dispatchEvent(new CustomEvent('post', {detail: {text: 'Connected!'}}))
}

ws.onclose = () => {
    dispatchEvent(new CustomEvent('post', {detail: {text: 'Disconnected.'}}))
}

ws.onmessage = ({data}) => {
    let event;
    try {
        data = JSON.parse(data)
        event = new CustomEvent(data.kind, {detail: data})
    } catch(error) {
        event = new CustomEvent('error', {detail: error})
    }
    dispatchEvent(event)
}

form.onsubmit = (e) => {
    e.preventDefault()
    const json = {kind: 'post', text: form.message.value}
    ws.send(JSON.stringify(json))
    form.message.value = ''
}
