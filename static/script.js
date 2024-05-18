const ws = new WebSocket(location.href.replace('http', 'ws'))

addEventListener('post', (e) => {
    const div = document.createElement('div')
    div.textContent = e.detail.text
    messages.appendChild(div)
})

addEventListener('error', (e) => {
    const div = document.createElement('div')
    div.onclick = (e) => errors.removeChild(div)
    setTimeout(() => errors.removeChild(div), 2000)
    div.textContent = e.detail.text
    errors.appendChild(div)
})

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
