import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'

interface WebcamStreamProps {
  username: string
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

const WebcamStream = ({ username, setStream }:WebcamStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [debugString, setDebugString] = useState('')
  const [hasError, setHasError] = useState(false)

  useEffect(() => {

    const startVideoStream = async () => {
      try {
        const config = {
          audio: { echoCancellation: true },
          video: { width: { ideal: 320 }, facingMode: 'user', frameRate: 26 }
        }
        const stream = await navigator.mediaDevices.getUserMedia(config)
        setStream(stream)
        setDebugString(generateDebugString(username, stream))
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing webcam:', error)
        setHasError(true)
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
  }, [])
  
  return (
    <div className="video-container">
      {hasError
      ? <p>There was an error accessing the webcam. Please check your device permissions.</p>
      : <video className="self" ref={videoRef} autoPlay playsInline muted></video>
      }
      <span className="overlay">{debugString}</span>
    </div>
  )
}

export default WebcamStream
