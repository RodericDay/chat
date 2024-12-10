const Chat = ({ messages, ws }) => {
  const postMessage = (e) => {
    e.preventDefault()
    const message = e.target.message.value
    ws?.send(JSON.stringify({ message }))
    e.target.message.value = ''
  }
  
  return <div className="chat">
    <form onSubmit={postMessage}>
      <input name="message" autoComplete="off" />
      <button type="submit">+</button>
    </form>
    <div>
    {messages.slice().reverse().map((message, idx: number) => (
      <div key={idx}>
        <b>{message.sender}:</b>
        <span>{message.message}</span>
      </div>
    ))}
    </div>
  </div>
}

export default Chat