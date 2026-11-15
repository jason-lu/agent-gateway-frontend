// AudioWorklet processor (runs in the AudioWorklet global scope): forwards
// microphone audio to the main thread as 16-bit PCM mono at 16 kHz, in 40 ms
// chunks. Resampling happens here because a browser may ignore the 16 kHz
// AudioContext rate and hand us the device rate instead.

const TARGET_RATE = 16000
const CHUNK_SAMPLES = 640 // 40 ms at 16 kHz

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.step = sampleRate / TARGET_RATE
    this.cursor = 0
    this.out = new Int16Array(CHUNK_SAMPLES)
    this.outLen = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel || channel.length === 0) return true

    for (;;) {
      const index = Math.floor(this.cursor)
      if (index >= channel.length) {
        this.cursor -= channel.length
        break
      }
      // Linear interpolation keeps speech intelligible when 48 kHz -> 16 kHz.
      const frac = this.cursor - index
      const a = channel[index]
      const b = index + 1 < channel.length ? channel[index + 1] : a
      let s = a + (b - a) * frac
      if (s > 1) s = 1
      else if (s < -1) s = -1
      this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff
      this.cursor += this.step
      if (this.outLen === CHUNK_SAMPLES) {
        const chunk = this.out.slice(0, this.outLen)
        this.port.postMessage(chunk.buffer, [chunk.buffer])
        this.out = new Int16Array(CHUNK_SAMPLES)
        this.outLen = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
