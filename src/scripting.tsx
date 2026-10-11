import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useLocation, useRoute } from 'wouter-preact'
import { Doc } from './doc'
import { Ui } from './ui'
import { CloseIcon, MenuIcon, MoonIcon } from './icons'
import reference from './scripting.json'

type Item = { id: string; title: string; body: string }
type Section = { id: string; title: string; intro: string; items: Item[] }

const doc: { title: string; intro: string; sections: Section[] } = reference
const owner = new Map<string, string>(doc.sections.flatMap((s) => [[s.id, s.id] as const, ...s.items.map((i) => [i.id, s.id] as const)]))
const plainClick = (e: MouseEvent) => !(e.ctrlKey || e.metaKey || e.shiftKey || e.button)

function Anchor({ id, onCopy }: { id: string; onCopy: (id: string) => void }) {
  return (
    <a
      class="ref-anchor"
      href={`/scripting/${id}`}
      aria-label="copy a link to this"
      onClick={(e) => plainClick(e) && (e.preventDefault(), onCopy(id))}
    >
      #
    </a>
  )
}

function Tree({ active, filter, onOpen }: { active: string; filter: string; onOpen: (id: string) => void }) {
  const side = useRef<HTMLElement>(null)
  const q = filter.trim().toLowerCase()
  const sections = useMemo(
    () =>
      q
        ? doc.sections
            .map((s) => (s.title.toLowerCase().includes(q) ? s : { ...s, items: s.items.filter((i) => i.title.toLowerCase().includes(q)) }))
            .filter((s) => s.items.length || s.title.toLowerCase().includes(q))
        : doc.sections,
    [q],
  )

  useEffect(() => side.current!.querySelector('.on')?.scrollIntoView({ block: 'nearest' }), [active, q])

  return (
    <nav class="ref-tree" ref={side}>
      {sections.map((s) => (
        <div key={s.id} class="ref-group">
          <a
            class={s.id === active ? 'ref-section on' : owner.get(active) === s.id ? 'ref-section in' : 'ref-section'}
            href={`/scripting/${s.id}`}
            onClick={(e) => plainClick(e) && (e.preventDefault(), onOpen(s.id))}
          >
            {s.title}
          </a>
          {s.items.map((i) => (
            <a
              key={i.id}
              class={i.id === active ? 'ref-link on' : 'ref-link'}
              href={`/scripting/${i.id}`}
              title={i.title}
              onClick={(e) => plainClick(e) && (e.preventDefault(), onOpen(i.id))}
            >
              {i.title}
            </a>
          ))}
        </div>
      ))}
      {sections.length === 0 && <div class="side-label">{doc.sections.length ? 'nothing found' : 'nothing here yet'}</div>}
    </nav>
  )
}

export function Scripting() {
  const [, params] = useRoute<{ slug?: string }>('/scripting/:slug?')
  const [, navigate] = useLocation()
  const slug = params?.slug ?? ''
  const [night, setNight] = useState(() => document.documentElement.dataset.theme === 'night')
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(slug)
  const [toast, setToast] = useState('')
  const main = useRef<HTMLElement>(null)
  const frame = useRef(0)

  const ui = useMemo(
    () => ({
      search: (q: string) => (setFilter(q), setOpen(true)),
      view: () => {},
      copy: (text: string) => {
        navigator.clipboard.writeText(text)
        setToast('copied to clipboard')
      },
      go: (to: string) => navigate(to),
    }),
    [],
  )

  const jump = (id: string) => {
    const target = main.current!.querySelector<HTMLElement>(`[data-ref="${CSS.escape(id)}"]`)
    if (!target) return
    target.scrollIntoView({ block: 'start' })
    target.classList.remove('flash')
    void target.offsetWidth
    target.classList.add('flash')
    setActive(id)
  }

  const openItem = (id: string) => {
    setOpen(false)
    if (id === slug) jump(id)
    else navigate(`/scripting/${id}`)
  }

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${location.origin}/scripting/${id}`)
    setToast('link copied')
    if (id !== slug) navigate(`/scripting/${id}`, { replace: true })
  }

  const spy = () => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const el = main.current
      if (!el) return
      let current = ''
      for (const mark of el.querySelectorAll<HTMLElement>('[data-ref]')) {
        if (mark.offsetTop - el.scrollTop > 96) break
        current = mark.dataset.ref!
      }
      setActive(current)
    })
  }

  useLayoutEffect(() => {
    if (slug) jump(slug)
    else main.current!.scrollTop = 0
  }, [slug])

  useEffect(() => {
    const title = document.title
    document.title = `${doc.title} · tele`
    return () => {
      document.title = title
      cancelAnimationFrame(frame.current)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'night' : 'day'
  }, [night])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <Ui.Provider value={ui}>
      <div class={open ? 'ref show-tree' : 'ref'}>
        <header class="ref-bar">
          <button class="icon ref-toggle" onClick={() => setOpen(!open)} aria-label="contents">
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
          <a class="ref-home" href="/" onClick={(e) => plainClick(e) && (e.preventDefault(), navigate('/'))}>
            <img src="/tele.jpg" alt="" width={30} height={30} />
            <b>tele</b>
          </a>
          <span class="ref-slash">/</span>
          <span class="ref-title">{doc.title}</span>
          <a class="ref-skill mono" href="/scripting/SKILL.md" target="_blank" rel="noopener" title="the whole reference as one file, for your ai agent">
            SKILL.md
          </a>
          <button
            class="icon"
            onClick={() => {
              localStorage.setItem('theme', night ? 'day' : 'night')
              setNight(!night)
            }}
            aria-label="night mode"
          >
            <MoonIcon />
          </button>
        </header>
        <div class="ref-body">
          <aside class="ref-side">
            <div class="side-head">
              <label class="search">
                <input
                  value={filter}
                  placeholder="filter"
                  onInput={(e) => setFilter(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFilter('')
                    if (e.key === 'Enter') e.currentTarget.closest('.ref-side')!.querySelector<HTMLElement>('.ref-tree a')?.click()
                  }}
                />
                {filter && (
                  <button class="clear" onClick={() => setFilter('')} aria-label="clear">
                    <CloseIcon />
                  </button>
                )}
              </label>
            </div>
            <Tree active={active} filter={filter} onOpen={openItem} />
          </aside>
          <div class="ref-shade" onClick={() => setOpen(false)} />
          <main class="ref-main" ref={main} onScroll={spy}>
            <article class="ref-doc doc">
              <h1>{doc.title}</h1>
              <Doc source={doc.intro} />
              {doc.sections.length === 0 && <p class="ref-empty">the reference isn't published yet</p>}
              {doc.sections.map((s) => (
                <section key={s.id} class="ref-part">
                  <h2 data-ref={s.id}>
                    {s.title}
                    <Anchor id={s.id} onCopy={copyLink} />
                  </h2>
                  <Doc source={s.intro} />
                  {s.items.map((i) => (
                    <div key={i.id} class="ref-item" data-ref={i.id}>
                      <h3>
                        <span>{i.title}</span>
                        <Anchor id={i.id} onCopy={copyLink} />
                      </h3>
                      <Doc source={i.body} />
                    </div>
                  ))}
                </section>
              ))}
              <footer class="ref-end">tele isn't made by telegram and isn't affiliated with it</footer>
            </article>
          </main>
        </div>
        {toast && <div class="toast">{toast}</div>}
      </div>
    </Ui.Provider>
  )
}
