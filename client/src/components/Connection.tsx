import ReconnectingWebSocket from 'reconnecting-websocket'
import { useEffect, useState } from "react"

const Connection = ({ username, setWs }) => {
    const [state, setState] = useState('')
    const opts = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']

    useEffect(() => {
        const ws = new ReconnectingWebSocket('wss://chat.roderic.ca')
        ws.onopen = () => {
            setState(opts[ws?.readyState || 0])
            ws.send(JSON.stringify({ username }))
        }
        ws.onclose = () => {
            setState(opts[ws?.readyState || 0])
        }
        setWs(ws)
        return () => ws?.close()
    }, [username])  

    return <span>{state}</span>
}

export default Connection