import ReconnectingWebSocket from 'reconnecting-websocket'
import { Dispatch, SetStateAction, useEffect, useState } from "react"

interface ConnectionProps {
    username: string
    setWs: Dispatch<SetStateAction<ReconnectingWebSocket | null>>
}

enum WebSocketState {
    CONNECTING = 'CONNECTING',
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
}

enum WebSocketColor {
    CONNECTING = 'gold',
    OPEN = 'lime',
    CLOSED = 'crimson',
}

const Connection = ({ username, setWs }:ConnectionProps) => {
    const [state, setState] = useState<WebSocketState>(WebSocketState.CONNECTING)

    useEffect(() => {
        const ws = new ReconnectingWebSocket('wss://chat.roderic.ca')
        setWs(ws)
        ws.onopen = () => {
            setState(WebSocketState.OPEN)
            ws.send(JSON.stringify({ username }))
        }
        ws.onclose = () => {
            setState(WebSocketState.CLOSED)
        }
        return () => ws?.close()
    }, [username, setWs])  

    return <div className='circle'
            style={ {backgroundColor: WebSocketColor[state] } }
            title={ state }
        ></div>
}

export default Connection