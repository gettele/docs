import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter-preact'
import { MoonIcon } from './icons'
import scripts from './catalog.json'

type Script = {
  id: string
  name: string
  description: string
  author: string
  icon?: string
  grants: string[]
  version: string
  homepage?: string
  file: string
  source: string
}

const catalog: Script[] = scripts

export function Catalog() {
  const [, navigate] = useLocation()
  const [night, setNight] = useState(() => document.documentElement.dataset.theme === 'night')
  const [toast, setToast] = useState('')

  const internal = (to: string) => (e: MouseEvent) => !(e.ctrlKey || e.metaKey || e.shiftKey || e.button) && (e.preventDefault(), navigate(to))

  useEffect(() => {
    const title = document.title
    document.title = 'script catalog · tele'
    return () => {
      document.title = title
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
    <div class="ref">
      <header class="ref-bar">
        <a class="ref-home" href="/" onClick={internal('/')}>
          <img src="/tele.jpg" alt="" width={30} height={30} />
          <b>tele</b>
        </a>
        <span class="ref-slash">/</span>
        <a class="ref-crumb" href="/scripting" onClick={internal('/scripting')}>
          scripting
        </a>
        <span class="ref-slash">/</span>
        <span class="ref-title">catalog</span>
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
      <main class="ref-main">
        <article class="ref-doc doc">
          <h1>script catalog</h1>
          <p>
            ready-made scripts for tele. <b>install in tele</b> opens tele's install box with the script's link filled in: nothing is installed
            until you press install there, and a script stays off until you turn it on in settings &gt; tele &gt; scripts and allow the grants it
            asks for. each one is a single file, so read it first and change it to taste; the{' '}
            <a href="/scripting" onClick={internal('/scripting')}>
              reference
            </a>{' '}
            explains every call.
          </p>
          {catalog.length === 0 && <p class="ref-empty">the catalog isn't published yet</p>}
          <div class="catalog">
            {catalog.map((script) => {
              const url = `${location.origin}${script.file}`
              const home = script.homepage?.replace(/^https:\/\/gettele\.app(?=\/)/, '')
              return (
                <section key={script.id} id={script.id} class="catalog-item">
                  <div class="catalog-icon">{script.icon ?? '📜'}</div>
                  <div class="catalog-body">
                    <h3>
                      {script.name}
                      <span class="catalog-meta">
                        v{script.version} · {script.author}
                      </span>
                    </h3>
                    <p>{script.description}</p>
                    <div class="catalog-grants">
                      {script.grants.length === 0 ? (
                        <span class="catalog-grant none">no grants</span>
                      ) : (
                        script.grants.map((grant) => (
                          <a key={grant} class="catalog-grant mono" href="/scripting/grants" onClick={internal('/scripting/grants')} title="what this grant allows">
                            {grant}
                          </a>
                        ))
                      )}
                    </div>
                    <div class="catalog-actions">
                      <a class="catalog-install" href={`tg://tele/script?url=${encodeURIComponent(url)}`}>
                        install in tele
                      </a>
                      <a href={script.source} target="_blank" rel="noopener">
                        view source
                      </a>
                      <button
                        class="catalog-copy"
                        onClick={() => {
                          navigator.clipboard.writeText(url)
                          setToast('link copied: paste it into install from a link')
                        }}
                      >
                        copy link
                      </button>
                      {home &&
                        (home.startsWith('/') ? (
                          <a href={home} onClick={internal(home)}>
                            how it works
                          </a>
                        ) : (
                          <a href={home} target="_blank" rel="noopener">
                            homepage
                          </a>
                        ))}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
          <footer class="ref-end">tele isn't made by telegram and isn't affiliated with it</footer>
        </article>
      </main>
      {toast && <div class="toast">{toast}</div>}
    </div>
  )
}
