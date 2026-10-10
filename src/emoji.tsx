import { useEffect, useRef } from 'preact/hooks'
import type { AnimationItem, LottiePlayer } from 'lottie-web'
import known from './emoji.json'

const emoji: Record<string, { adaptive: boolean }> = known

let player: Promise<LottiePlayer> | null = null
const animations = new Map<string, Promise<unknown>>()

export function CustomEmoji({ id, alt }: { id: string; alt: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const adaptive = emoji[id]?.adaptive ?? false

  useEffect(() => {
    if (!emoji[id]) return
    const el = box.current!
    let stopped = false
    let animation: AnimationItem | null = null
    const visible = new IntersectionObserver(([entry]) => {
      if (!animation) return
      if (entry.isIntersecting) animation.play()
      else animation.pause()
    })
    player ??= import('lottie-web/build/player/esm/lottie_light.min.js').then((m) => m.default)
    if (!animations.has(id)) animations.set(id, fetch(`/emoji/${id}.json`).then((r) => r.json()))
    Promise.all([player, animations.get(id)!]).then(([lottie, data]) => {
      if (stopped) return
      animation = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: structuredClone(data),
      })
      el.classList.add('ready')
      visible.observe(el)
    })
    return () => {
      stopped = true
      visible.disconnect()
      animation?.destroy()
    }
  }, [id])

  return (
    <span ref={box} class={adaptive ? 'emoji adaptive' : 'emoji'} role="img" aria-label={alt}>
      <span class="emoji-alt">{alt}</span>
    </span>
  )
}
