const ws = new WebSocket(location.href.replace('http', 'ws'))

ws.onmessage = ({data}) => {
    const div = document.createElement('li')
    div.textContent = data
    messages.appendChild(div)
}

form.onsubmit = (e) => {
    e.preventDefault()
    ws.send(form.message.value)
    form.message.value = ''
}
