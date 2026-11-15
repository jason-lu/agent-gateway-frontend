// AudioWorklet evaluates the processor in its own global scope, so it must not
// be bundled as a module. `?raw` inlines the source and a Blob URL loads it.
import workletSource from './pcm-worklet.js?raw'

const workletUrl = URL.createObjectURL(
  new Blob([workletSource], { type: 'application/javascript' }),
)

/**
 * Microphone capture producing 16-bit PCM mono at 16 kHz in ~40 ms chunks.
 * One recorder per recognition session; call stop() to release the mic.
 */
export interface PcmRecorderHandlers {
  onAudio: (pcm: ArrayBuffer) => void
  onError: (message: string) => void
}

const TARGET_RATE = 16000

export class PcmRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null

  constructor(private readonly handlers: PcmRecorderHandlers) {}

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      this.context = new AudioContext({ sampleRate: TARGET_RATE })
      await this.context.audioWorklet.addModule(workletUrl)
      const source = this.context.createMediaStreamSource(this.stream)
      this.node = new AudioWorkletNode(this.context, 'pcm-capture')
      this.node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        this.handlers.onAudio(event.data)
      }
      // The worklet is a sink: connecting it keeps the graph pulling without
      // routing the mic to the speakers.
      source.connect(this.node)
    } catch (err) {
      this.stop()
      const message = err instanceof Error ? err.message : String(err)
      this.handlers.onError(
        /NotAllowed|Permission/i.test(message) ? '麦克风权限被拒绝' : `无法打开麦克风：${message}`,
      )
      throw err
    }
  }

  stop(): void {
    this.node?.port.close()
    this.node?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.context?.close()
    this.node = null
    this.stream = null
    this.context = null
  }
}

/** Root-mean-square of a PCM16 chunk, normalized to 0..1 — drives the silence detector. */
export function pcmRms(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm)
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 32768
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}
