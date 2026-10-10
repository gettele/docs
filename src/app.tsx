import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useLocation, useRoute } from 'wouter-preact'
import { chats, releaseName, type Chat, type Message } from './chats'
import { Markup } from './markup'
import { CustomEmoji } from './emoji'
import { Ui, type Photo } from './ui'
import { BackIcon, CloseIcon, CodeIcon, DownIcon, IssueIcon, MenuIcon, MoonIcon, SearchIcon, WindowIcon } from './icons'
import data from './data.json'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const shortTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const longDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' })
const longDayYear = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function listDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return shortTime.format(date)
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return weekday.format(date).toLowerCase()
  return shortDay.format(date).toLowerCase()
}

function pillDate(iso: string) {
  const date = new Date(iso)
  return (date.getFullYear() === new Date().getFullYear() ? longDay : longDayYear).format(date).toLowerCase()
}

function Avatar({ chat, size = 46 }: { chat: Chat; size?: number }) {
  return (
    <span
      class={chat.avatar.src ? 'avatar' : `avatar letter ${chat.avatar.color}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.42)}px`,
        backgroundImage: chat.avatar.src ? `url(${chat.avatar.src})` : '',
      }}
    >
      {chat.avatar.src ? '' : chat.avatar.letter}
    </span>
  )
}

function Name({ chat, row }: { chat: Chat; row?: boolean }) {
  return (
    <span class="name">
      {row && chat.channel && <i class="channel-icon" />}
      <b>{chat.title}</b>
      {chat.verified && (
        <span class="verified" title="verified">
          <i class="star" />
          <i class="check" />
        </span>
      )}
    </span>
  )
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query)
  if (at < 0 || query.startsWith('#')) return <>{text}</>
  const from = Math.max(0, at - 24)
  return (
    <>
      {from > 0 && '…'}
      {text.slice(from, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}

function Sidebar({
  active,
  query,
  scope,
  onQuery,
  onScope,
  onMenu,
  onOpen,
  inputRef,
}: {
  active: string
  query: string
  scope: string | null
  onQuery: (q: string) => void
  onScope: (s: string | null) => void
  onMenu: () => void
  onOpen: () => void
  inputRef: { current: HTMLInputElement | null }
}) {
  const [, navigate] = useLocation()
  const q = query.trim().toLowerCase()
  const scoped = chats.find((c) => c.id === scope)
  const results = useMemo(() => {
    if (!q) return null
    const pool = scoped ? [scoped] : chats
    const found = scoped ? [] : chats.filter((c) => c.title.toLowerCase().includes(q))
    const messages = pool
      .flatMap((chat) => chat.messages.filter((m) => m.plain!.toLowerCase().includes(q)).map((m) => ({ chat, m })))
      .sort((a, b) => b.m.date.localeCompare(a.m.date))
    return { found, messages }
  }, [q, scoped])

  return (
    <aside class="side">
      <div class="side-head">
        <button class="icon" onClick={onMenu} aria-label="menu">
          <MenuIcon />
        </button>
        <label class="search">
          {scoped && (
            <span class="scope">
              {scoped.title}
              <button onClick={() => onScope(null)} aria-label="search everywhere">
                <CloseIcon />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            placeholder={scoped ? 'search messages' : 'search'}
            onInput={(e) => onQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onQuery('')
                onScope(null)
                e.currentTarget.blur()
              }
              if (e.key === 'Backspace' && !query && scoped) onScope(null)
            }}
          />
          {(query || scoped) && (
            <button
              class="clear"
              onClick={() => {
                onQuery('')
                onScope(null)
              }}
              aria-label="clear"
            >
              <CloseIcon />
            </button>
          )}
        </label>
      </div>
      <div class="side-list">
        {!results &&
          chats.map((c) => {
            const last = c.messages.at(-1)!
            return (
              <button key={c.id} class={c.id === active ? 'row on' : 'row'} onClick={() => (onOpen(), navigate(c.id === 'tele' ? '/' : `/${c.id}`))}>
                <Avatar chat={c} />
                <span class="row-text">
                  <span class="row-top">
                    <Name chat={c} row />
                    <span class="date">{listDate(last.date)}</span>
                  </span>
                  <span class="row-bottom">
                    <span class="row-preview">{last.photo ? 'photo' : last.plain}</span>
                    {c.pinned && <i class="pin-icon" title="pinned" />}
                  </span>
                </span>
              </button>
            )
          })}
        {results && (
          <>
            {results.found.length > 0 && <div class="side-label">chats</div>}
            {results.found.map((c) => (
              <button key={c.id} class="row" onClick={() => (onQuery(''), onOpen(), navigate(`/${c.id}`))}>
                <Avatar chat={c} />
                <span class="row-text">
                  <span class="row-top">
                    <Name chat={c} row />
                  </span>
                  <span class="row-preview">{c.subtitle}</span>
                </span>
              </button>
            ))}
            <div class="side-label">
              {results.messages.length === 0
                ? 'no messages found'
                : `${results.messages.length} message${results.messages.length === 1 ? '' : 's'}`}
            </div>
            {results.messages.slice(0, 200).map(({ chat, m }) => (
              <button key={`${chat.id}/${m.id}`} class="row" onClick={() => (onOpen(), navigate(`/${chat.id}/${m.id}`))}>
                <Avatar chat={chat} />
                <span class="row-text">
                  <span class="row-top">
                    <Name chat={chat} row />
                    <span class="date">{listDate(m.date)}</span>
                  </span>
                  <span class="row-preview">
                    <Highlighted text={m.plain!.replace(/\s+/g, ' ')} query={q} />
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function Bubble({ chat, m, onView }: { chat: Chat; m: Message; onView: (p: Photo) => void }) {
  const [, navigate] = useLocation()
  const target = m.reply && chat.messages.find((x) => x.id === m.reply!.to)
  return (
    <div class={m.out ? 'msg out' : 'msg'} data-msg={m.id}>
      <div class={m.photo && !m.text ? 'bubble media-only' : 'bubble'}>
        {m.reply && target && (
          <button class="reply" onClick={() => navigate(`/${chat.id}/${target.id}`)}>
            <b>{target.out ? 'you' : (chat.author ?? chat.title)}</b>
            <span>{m.reply.quote ?? target.plain}</span>
          </button>
        )}
        {m.photo && (
          <button class="photo" onClick={() => onView({ ...m.photo!, caption: m.plain })}>
            <img src={m.photo.src} alt={m.photo.alt} loading="lazy" />
          </button>
        )}
        {m.text && (
          <div class="text">
            <Markup source={m.text} />
            <span class="time" title={new Date(m.date).toString()}>
              {timeFormat.format(new Date(m.date))}
              {m.out && <span class="ticks">✓✓</span>}
            </span>
          </div>
        )}
      </div>
      {m.buttons && (
        <div class="keys">
          {m.buttons.map((row, i) => (
            <div key={i} class="keys-row">
              {row.map((b) =>
                b.href.startsWith('/') ? (
                  <button key={b.text} onClick={() => navigate(b.href)}>
                    {b.icon && <CustomEmoji id={b.icon} alt="" />}
                    {b.text}
                  </button>
                ) : (
                  <a key={b.text} href={b.href}>
                    {b.icon && <CustomEmoji id={b.icon} alt="" />}
                    {b.text}
                  </a>
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChatView({ chat, jump, onView, onSearchIn }: { chat: Chat; jump: number | null; onView: (p: Photo) => void; onSearchIn: () => void }) {
  const [, navigate] = useLocation()
  const scroller = useRef<HTMLDivElement>(null)
  const [down, setDown] = useState(false)

  useLayoutEffect(() => {
    const el = scroller.current!
    if (jump !== null) {
      const target = el.querySelector<HTMLElement>(`[data-msg="${jump}"]`)
      if (target) {
        target.scrollIntoView({ block: 'center' })
        target.classList.remove('flash')
        void target.offsetWidth
        target.classList.add('flash')
        return
      }
    }
    el.scrollTop = chat.openAt === 'bottom' ? el.scrollHeight : 0
  }, [chat.id, jump])

  const groups: { key: string; label: string; messages: Message[] }[] = []
  for (const m of chat.messages) {
    const key = chat.pills === 'release' ? releaseName(m.date) || m.date.slice(0, 10) : new Date(m.date).toDateString()
    if (groups.at(-1)?.key !== key)
      groups.push({ key, label: chat.pills === 'release' ? `${key} · ${pillDate(m.date)}` : pillDate(m.date), messages: [] })
    groups.at(-1)!.messages.push(m)
  }

  return (
    <main class="chat">
      <header class="chat-head">
        <button class="icon back" onClick={() => navigate('/chats')} aria-label="back">
          <BackIcon />
        </button>
        <Avatar chat={chat} size={42} />
        <div class="chat-title">
          <Name chat={chat} />
          <span class="subtitle">{chat.subtitle}</span>
        </div>
        <button class="icon" onClick={onSearchIn} aria-label={`search in ${chat.title}`}>
          <SearchIcon />
        </button>
      </header>
      {chat.pinnedMessage && (
        <button
          class="pinned"
          onClick={() => chat.pinnedMessage!.to && navigate(`/${chat.id}/${chat.pinnedMessage!.to}`)}
          disabled={!chat.pinnedMessage.to}
        >
          <b>pinned message</b>
          <span>{chat.pinnedMessage.text}</span>
        </button>
      )}
      <div
        class="scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          setDown(el.scrollHeight - el.scrollTop - el.clientHeight > 600)
        }}
      >
        <div class="messages">
          {groups.map((g) => (
            <section key={g.key} class="group">
              <div class="pill">
                <span>{g.label}</span>
              </div>
              {g.messages.map((m) => (
                <Bubble key={m.id} chat={chat} m={m} onView={onView} />
              ))}
            </section>
          ))}
        </div>
      </div>
      {down && (
        <button
          class="to-bottom"
          onClick={() => scroller.current!.scrollTo({ top: scroller.current!.scrollHeight, behavior: 'smooth' })}
          aria-label="scroll to the bottom"
        >
          <DownIcon />
        </button>
      )}
    </main>
  )
}

function Viewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])
  return (
    <div class="viewer" onClick={onClose}>
      <button class="icon viewer-close" aria-label="close">
        <CloseIcon />
      </button>
      <img src={photo.src} alt={photo.alt} onClick={(e) => e.stopPropagation()} />
      {photo.caption && <p onClick={(e) => e.stopPropagation()}>{photo.caption}</p>}
    </div>
  )
}

const mac = /mac/i.test(navigator.platform)

function placeWindow(frame: HTMLElement, x: number, y: number) {
  const left = (innerWidth - frame.offsetWidth) / 2
  const top = (innerHeight - frame.offsetHeight) / 2
  x = Math.min(Math.max(x, 240 - frame.offsetWidth - left), innerWidth - 120 - left)
  y = Math.min(Math.max(y, -top), innerHeight - 24 - top)
  frame.style.transform = x || y ? `translate(${x}px, ${y}px)` : ''
  frame.dataset.x = String(x)
  frame.dataset.y = String(y)
}

function TitleBar() {
  const label = `tele #${data.latest.tag.replace(/^.*-tele\./, '')}`
  const bar = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useLayoutEffect(() => {
    const frame = bar.current!.parentElement!
    const saved = JSON.parse(localStorage.getItem('window-position') ?? '[0, 0]')
    placeWindow(frame, saved[0], saved[1])
    const resized = () => placeWindow(frame, Number(frame.dataset.x), Number(frame.dataset.y))
    addEventListener('resize', resized)
    return () => {
      removeEventListener('resize', resized)
      frame.style.transform = ''
    }
  }, [])

  const release = () => {
    if (!drag.current) return
    drag.current = null
    const frame = bar.current!.parentElement!
    localStorage.setItem('window-position', JSON.stringify([Number(frame.dataset.x), Number(frame.dataset.y)]))
  }

  const handlers = {
    ref: bar,
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest('.controls, .lights')) return
      e.preventDefault()
      bar.current!.setPointerCapture(e.pointerId)
      const frame = bar.current!.parentElement!
      drag.current = { x: Number(frame.dataset.x), y: Number(frame.dataset.y), px: e.clientX, py: e.clientY }
    },
    onPointerMove: (e: PointerEvent) => {
      if (!drag.current) return
      placeWindow(bar.current!.parentElement!, drag.current.x + e.clientX - drag.current.px, drag.current.y + e.clientY - drag.current.py)
    },
    onPointerUp: release,
    onPointerCancel: release,
  }

  return mac ? (
    <div class="titlebar mac" {...handlers}>
      <span class="lights" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span class="title">{label}</span>
    </div>
  ) : (
    <div class="titlebar" {...handlers}>
      <span class="title">{label}</span>
      <span class="controls" aria-hidden="true">
        <span class="minimize">
          <i />
        </span>
        <span class="maximize">
          <i />
        </span>
        <span class="close">
          <i />
        </span>
      </span>
    </div>
  )
}

function Drawer({
  night,
  windowed,
  onNight,
  onWindowed,
  onClose,
}: {
  night: boolean
  windowed: boolean
  onNight: () => void
  onWindowed: () => void
  onClose: () => void
}) {
  return (
    <div class="drawer-shade" onClick={onClose}>
      <nav class="drawer" onClick={(e) => e.stopPropagation()}>
        <div class="drawer-head">
          <img src="/icon.png" alt="" width={56} height={56} />
          <b>tele</b>
          <span>{data.latest.tag}</span>
        </div>
        <button class="drawer-item" onClick={onNight}>
          <MoonIcon />
          night mode
          <span class={night ? 'switch on' : 'switch'} />
        </button>
        <button class="drawer-item wide-only" onClick={onWindowed}>
          <WindowIcon />
          window mode
          <span class={windowed ? 'switch on' : 'switch'} />
        </button>
        <a class="drawer-item" href="https://github.com/nitreojs/tele" target="_blank" rel="noopener noreferrer">
          <CodeIcon />
          source code
        </a>
        <a class="drawer-item" href="https://github.com/nitreojs/tele/issues" target="_blank" rel="noopener noreferrer">
          <IssueIcon />
          report a problem
        </a>
        <p class="drawer-foot">tele isn't made by telegram and isn't affiliated with it</p>
      </nav>
    </div>
  )
}

export function App() {
  const [, params] = useRoute<{ chat?: string; id?: string }>('/:chat?/:id?')
  const [location, navigate] = useLocation()
  const listOnly = params?.chat === 'chats'
  const chat = chats.find((c) => c.id === (listOnly ? 'tele' : (params?.chat ?? 'tele'))) ?? chats[0]
  const jump = params?.id ? Number(params.id) : null

  const [night, setNight] = useState(() => document.documentElement.dataset.theme === 'night')
  const [windowed, setWindowed] = useState(() => localStorage.getItem('window') === 'on')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileList, setMobileList] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => setMobileList(location === '/chats'), [location])

  useEffect(() => {
    const timers = new WeakMap<Element, number>()
    const scrolled = (e: Event) => {
      const el = e.target
      if (!(el instanceof Element)) return
      el.classList.add('scrolling')
      clearTimeout(timers.get(el))
      timers.set(el, window.setTimeout(() => el.classList.remove('scrolling'), 1000))
    }
    document.addEventListener('scroll', scrolled, true)
    return () => document.removeEventListener('scroll', scrolled, true)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day'
  }, [night])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (params?.chat && !listOnly && !chats.some((c) => c.id === params.chat)) navigate('/', { replace: true })
  }, [params?.chat])

  const ui = useMemo(
    () => ({
      search: (q: string, s?: string) => {
        setScope(s ?? null)
        setQuery(q)
        setMobileList(true)
        input.current?.focus()
      },
      view: setPhoto,
      copy: (text: string) => {
        navigator.clipboard.writeText(text)
        setToast('copied to clipboard')
      },
    }),
    [],
  )

  return (
    <Ui.Provider value={ui}>
      <div class={windowed ? 'desk windowed' : 'desk'}>
        {photo && <Viewer photo={photo} onClose={() => setPhoto(null)} />}
        <div class="window">
          {windowed && <TitleBar />}
          <div class={mobileList ? 'app show-list' : 'app show-chat'}>
            <Sidebar
              active={chat.id}
              query={query}
              scope={scope}
              onQuery={setQuery}
              onScope={setScope}
              onMenu={() => setMenu(true)}
              onOpen={() => setMobileList(false)}
              inputRef={input}
            />
            <ChatView chat={chat} jump={jump} onView={setPhoto} onSearchIn={() => ui.search('', chat.id)} />
            {menu && (
              <Drawer
                night={night}
                windowed={windowed}
                onWindowed={() => {
                  localStorage.setItem('window', windowed ? 'off' : 'on')
                  setWindowed(!windowed)
                }}
                onNight={() => {
                  localStorage.setItem('theme', night ? 'day' : 'night')
                  setNight(!night)
                }}
                onClose={() => setMenu(false)}
              />
            )}
            {toast && <div class="toast">{toast}</div>}
          </div>
        </div>
      </div>
    </Ui.Provider>
  )
}
