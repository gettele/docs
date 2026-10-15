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

const keyword = /^(type|class|interface|grant:) (.+)$/

function Title({ text, code }: { text: string; code?: boolean }) {
  const parts = text.match(keyword)
  if (parts) {
    return (
      <>
        <span class="ref-kw">{parts[1].replace(':', '')}</span> <span class="ref-code">{parts[2]}</span>
      </>
    )
  }
  return code || /[()]/.test(text) || /^[\w$]+(\.[\w$]+)+/.test(text) ? <span class="ref-code">{text}</span> : <span>{text}</span>
}

type Row = { item: Item; depth: number; label: string; parent: number }

function rowsOf(items: Item[]): Row[] {
  const rows: Row[] = []
  const open: { row: number; path?: string; close?: string; last?: string; type?: string; member?: string }[] = []
  for (const item of items) {
    const { title } = item
    const typed = title.match(/^(?:type|class|interface) ([\w$]+)$/)?.[1]
    const name = title.match(/^([\w$]+)\./)?.[1]
    let parent: (typeof open)[number] | undefined
    let label = title
    while (open.length && !parent) {
      const top = open.at(-1)!
      if (!top.member && top.type && name && name !== 'tg' && top.type.toLowerCase().includes(name.toLowerCase())) {
        top.member = `${name}.`
      }
      const prefix = [top.path, top.member].find((p) => p && title.startsWith(p) && title.length > p.length)
      if (prefix) {
        parent = top
        label = title.slice(prefix.length)
        if (prefix === top.path && top.close && label.endsWith(top.close)) label = label.slice(0, -top.close.length)
      } else if (top.last && typed?.toLowerCase().startsWith(top.last.toLowerCase())) {
        parent = top
      } else {
        open.pop()
      }
    }
    rows.push({ item, depth: open.length, label, parent: parent?.row ?? -1 })
    const grant = /^grant: [\w.]+$/.test(title)
    const path = /^[\w$]+(\.[\w$]+)*$/.test(title)
    open.push({
      row: rows.length - 1,
      path: grant ? `${title}(` : path ? `${title}.` : undefined,
      close: grant ? ')' : undefined,
      last: path ? title.split('.').at(-1) : undefined,
      type: typed ?? title.match(/(?:^|\.)([A-Z][\w$]*)$/)?.[1],
    })
  }
  return rows
}

const trees: Record<string, Row[]> = Object.fromEntries(doc.sections.map((s) => [s.id, rowsOf(s.items)]))

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
  const sections = useMemo(() => {
    const all = doc.sections.map((s) => ({ section: s, rows: trees[s.id] }))
    if (!q) return all
    return all
      .map(({ section, rows }) => {
        if (section.title.toLowerCase().includes(q)) return { section, rows }
        const keep = new Set<number>()
        rows.forEach((row, index) => {
          if (!row.item.title.toLowerCase().includes(q)) return
          for (let at = index; at >= 0 && !keep.has(at); at = rows[at].parent) keep.add(at)
        })
        return { section, rows: rows.filter((_, index) => keep.has(index)) }
      })
      .filter(({ section, rows }) => rows.length || section.title.toLowerCase().includes(q))
  }, [q])

  useEffect(() => side.current!.querySelector('.on')?.scrollIntoView({ block: 'nearest' }), [active, q])

  return (
    <nav class="ref-tree" ref={side}>
      {sections.map(({ section: s, rows }) => (
        <div key={s.id} class="ref-group">
          <a
            class={s.id === active ? 'ref-section on' : owner.get(active) === s.id ? 'ref-section in' : 'ref-section'}
            href={`/scripting/${s.id}`}
            onClick={(e) => plainClick(e) && (e.preventDefault(), onOpen(s.id))}
          >
            {s.title}
          </a>
          {rows.map(({ item: i, depth, label }) => (
            <a
              key={i.id}
              class={`ref-link${depth ? ' sub' : ''}${i.id === active ? ' on' : ''}`}
              style={{ '--depth': depth }}
              href={`/scripting/${i.id}`}
              title={i.title}
              onClick={(e) => plainClick(e) && (e.preventDefault(), onOpen(i.id))}
            >
              <Title text={label} code={depth > 0} />
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
          <a class="ref-skill" href="/scripting/catalog" onClick={(e) => plainClick(e) && (e.preventDefault(), navigate('/scripting/catalog'))}>
            catalog
          </a>
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
                        <Title text={i.title} />
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
