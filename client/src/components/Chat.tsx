import { useState, FormEvent } from "react"
import ReconnectingWebSocket from "reconnecting-websocket"

type Message = {
  sender: string,
  message: string,
}

interface ChatProps {
  messages: Message[]
  ws: ReconnectingWebSocket
}

const Chat = ({ messages, ws }: ChatProps) => {
  const [string, setString] = useState('')

  const postMessage = (e: FormEvent) => {
    e.preventDefault()
    ws?.send(JSON.stringify({ message: string }))
    setString('')
  }
  
  return <div className="chat">
    <form onSubmit={postMessage}>
      <input name="message" autoComplete="off" onChange={(e) => setString(e.target.value)} value={string}/>
      <button type="submit">+</button>
    </form>
    <div>
    {messages.slice().reverse().map((message: Message, idx: number) => (
      <div key={idx}>
        <b>{message.sender}:</b>
        <span>{message.message}</span>
      </div>
    ))}
    </div>
  </div>
}

export default Chat