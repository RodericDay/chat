import { useEffect, useRef } from "react"

const getScreen = async () => {
  return await navigator.mediaDevices.getDisplayMedia()
}

const ScreenShare = ({ ws }:{ ws: WebSocket }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const message = JSON.parse(e.data)
      console.log('@', message)
    }
    ws.addEventListener('message', onMessage)
    return () => {
      ws.removeEventListener('message', onMessage)
    }
  }, [ws])

  useEffect(() => {
    const startScreenShare = async () => {
      streamRef.current = await getScreen()
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
      ws.send(JSON.stringify({ kind: 'screen' }))
    }

    startScreenShare()
    console.log('Started screen sharing')

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        console.log('Stopped screen sharing')
      }
    }
  }, [])

  return (
    <div className="video-container screen-share">
      <video ref={videoRef} autoPlay playsInline />
      <span className="overlay">shared screen</span>
    </div>
  )
}

export default ScreenShare
