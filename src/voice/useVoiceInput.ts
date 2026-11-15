import { useCallback, useEffect, useRef, useState } from 'react'
import { PcmRecorder, pcmRms } from './audio'
import { AsrStreamClient } from './asrClient'

export type VoiceInputState = 'idle' | 'connecting' | 'listening' | 'ending' | 'countdown'

/** Grace period between the final text and the auto-send; cancel aborts it. */
export const CANCEL_WINDOW_MS = 600

/** RMS (0..1) above this counts as speech. */
const SPEECH_RMS = 0.015
/** Auto-stop after this long without speech, once speech has been heard. */
const SILENCE_MS = 1200

interface UseVoiceInputOptions {
  language?: string
  /** Auto-sent after the cancel window when speech ends. */
  onSend: (text: string) => void
  /** Handed back (into the composer) when the user cancels the auto-send. */
  onCanceled: (text: string) => void
}

export interface UseVoiceInput {
  state: VoiceInputState
  /** Full draft text; replace wholesale on every update (partials revise). */
  draft: string
  error: string | null
  start: () => void
  stop: () => void
  cancel: () => void
}

/**
 * Voice input state machine:
 * idle → connecting → listening → ending → countdown → idle.
 * Partials render as a provisional draft (revisions expected); the final text
 * triggers a short cancel window and then fires onSend.
 */
export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInput {
  const [state, setState] = useState<VoiceInputState>('idle')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const recorderRef = useRef<PcmRecorder | null>(null)
  const clientRef = useRef<AsrStreamClient | null>(null)
  const stateRef = useRef<VoiceInputState>('idle')
  const finalTextRef = useRef('')
  const heardSpeechRef = useRef(false)
  const lastSpeechRef = useRef(0)
  const sendTimerRef = useRef<number | null>(null)
  const watchdogRef = useRef<number | null>(null)

  const transition = useCallback((next: VoiceInputState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const teardown = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    clientRef.current?.close()
    clientRef.current = null
    if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current)
    sendTimerRef.current = null
    if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current)
    watchdogRef.current = null
  }, [])

  /** Hands the recognized text to the chat and returns to idle. */
  const commit = useCallback(() => {
    const text = finalTextRef.current
    teardown()
    finalTextRef.current = ''
    setDraft('')
    transition('idle')
    if (text) optionsRef.current.onSend(text)
  }, [teardown, transition])

  const cancel = useCallback(() => {
    if (stateRef.current !== 'countdown') return
    const text = finalTextRef.current
    teardown()
    finalTextRef.current = ''
    setDraft('')
    transition('idle')
    if (text) optionsRef.current.onCanceled(text)
  }, [teardown, transition])

  /** User says "done" — stop capturing and ask the server for the final text. */
  const stop = useCallback(() => {
    if (stateRef.current !== 'listening') return
    transition('ending')
    recorderRef.current?.stop()
    recorderRef.current = null
    clientRef.current?.finish()
  }, [transition])

  const handleFinal = useCallback(
    (text: string) => {
      if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current)
      watchdogRef.current = null
      if (!text) {
        teardown()
        transition('idle')
        setDraft('')
        setError('没有识别到语音内容')
        return
      }
      finalTextRef.current = text
      setDraft(text)
      transition('countdown')
      sendTimerRef.current = window.setTimeout(() => commit(), CANCEL_WINDOW_MS)
    },
    [commit, teardown, transition],
  )

  const start = useCallback(() => {
    if (stateRef.current !== 'idle') return
    teardown()
    setError(null)
    setDraft('')
    finalTextRef.current = ''
    heardSpeechRef.current = false
    lastSpeechRef.current = 0
    transition('connecting')

    const client = new AsrStreamClient()
    clientRef.current = client

    client.connect(optionsRef.current.language ?? 'zh-CN', {
      onEvent: (event) => {
        if (event.type === 'ready') {
          const recorder = new PcmRecorder({
            onAudio: (pcm) => {
              if (pcmRms(pcm) >= SPEECH_RMS) {
                heardSpeechRef.current = true
                lastSpeechRef.current = Date.now()
              }
              clientRef.current?.sendAudio(pcm)
            },
            onError: (message) => {
              setError(message)
              teardown()
              transition('idle')
            },
          })
          recorderRef.current = recorder
          recorder.start().catch(() => {
            // Reported through onError already.
          })
          transition('listening')
          // "说完自动发送": end the utterance once speech has stopped for a while.
          watchdogRef.current = window.setInterval(() => {
            if (stateRef.current !== 'listening' || !heardSpeechRef.current) return
            if (Date.now() - lastSpeechRef.current >= SILENCE_MS) stop()
          }, 200)
        } else if (event.type === 'partial') {
          setDraft(event.text)
        } else if (event.type === 'final') {
          handleFinal(event.text)
        } else if (event.type === 'error') {
          setError(event.message)
          teardown()
          setDraft('')
          transition('idle')
        }
      },
      onClose: () => {
        // A clean finish already went through 'final'; anything else mid-capture
        // is a dropped transport.
        const current = stateRef.current
        if (current === 'connecting' || current === 'listening' || current === 'ending') {
          setError('语音连接中断，请重试')
          teardown()
          setDraft('')
          transition('idle')
        }
      },
    })
  }, [handleFinal, stop, teardown, transition])

  useEffect(() => () => teardown(), [teardown])

  return { state, draft, error, start, stop, cancel }
}
