import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'

const config = {
  audio: { echoCancellation: true },
  video: { width: { ideal: 320 }, facingMode: 'user', frameRate: 26 }
}

interface WebcamStreamProps {
  username: string
  bordersOn: boolean
  debugOn: boolean
  stream: MediaStream
  setStream: Dispatch<SetStateAction<MediaStream>>
}

const generateDebugString = (username: string, stream: MediaStream) => {
  const tracks = Object.fromEntries(
    stream.getTracks().map((e: { label: string, kind: string }) => [e.kind, e.label])
  )
  return JSON.stringify({
    username,
    tracks,
  }, null, 2)
  
}

const WebcamStream = ({ debugOn, bordersOn, username, stream, setStream }:WebcamStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [debugString, setDebugString] = useState('')

  useEffect(() => {

    const startVideoStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(config)
        setStream(stream)
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing webcam:', error)
      }
    }

    startVideoStream()

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const tracks = stream.getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [setStream])

  useEffect(() => {
    setDebugString(debugOn ? generateDebugString(username, stream) : username)
  }, [username, stream, debugOn])
  
  return (
    <div className="video-container">
      <video
        ref={videoRef}
        className="self"
        style={ { objectFit: bordersOn ? 'contain' : 'cover' } }
        autoPlay 
        playsInline 
        muted>
      </video>
      <span className="overlay">{debugString}</span>
    </div>
  )
}

export default WebcamStream
