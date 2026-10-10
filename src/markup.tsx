import { useContext, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Link } from 'wouter-preact'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import { Ui } from './ui'
import { CustomEmoji } from './emoji'

hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic' | 'spoiler'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'hashtag'; tag: string }
  | { type: 'emoji'; id: string; alt: string }
  | { type: 'br' }

export type Block =
  | { type: 'p'; children: Inline[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'pre'; lang: string; code: string }

const inlinePattern =
  /\\([\\`*_|[\]#>])|`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\|\|(.+?)\|\||!\[([^\]]+)\]\(tg:\/\/emoji\?id=(\d+)\)|\[((?:\\.|[^\]])+)\]\(([^)\s]+)\)|(^|[\s(])#([a-z][\w]*)|(https?:\/\/[^\s)]+)|(\n)/g

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  let last = 0
  const flush = () => {
    if (text) out.push({ type: 'text', text })
    text = ''
  }
  for (const m of source.matchAll(inlinePattern)) {
    text += source.slice(last, m.index)
    last = m.index + m[0].length
    const [, escaped, code, bold, italic, spoiler, emojiAlt, emojiId, label, href, before, tag, url, br] = m
    if (escaped) {
      text += escaped
      continue
    }
    if (tag) text += before
    flush()
    if (code) out.push({ type: 'code', text: code })
    else if (bold) out.push({ type: 'bold', children: parseInline(bold) })
    else if (italic) out.push({ type: 'italic', children: parseInline(italic) })
    else if (spoiler) out.push({ type: 'spoiler', children: parseInline(spoiler) })
    else if (emojiId) out.push({ type: 'emoji', id: emojiId, alt: emojiAlt })
    else if (label) out.push({ type: 'link', href, children: parseInline(label) })
    else if (tag) out.push({ type: 'hashtag', tag })
    else if (url) out.push({ type: 'link', href: url, children: [{ type: 'text', text: url.replace(/^https?:\/\//, '') }] })
    else if (br) out.push({ type: 'br' })
  }
  text += source.slice(last)
  flush()
  return out
}

export function parse(source: string): Block[] {
  const blocks: Block[] = []
  const parts = source.split(/```(\w*)\n([\s\S]*?)\n```\n?/)
  for (let i = 0; i < parts.length; i += 3) {
    const lines = parts[i].replace(/^\n+|\n+$/g, '').split('\n')
    let quote: string[] = []
    let para: string[] = []
    const flushQuote = () => quote.length && blocks.push({ type: 'quote', children: parseInline(quote.join('\n')) })
    const flushPara = () => para.length && blocks.push({ type: 'p', children: parseInline(para.join('\n')) })
    for (const line of lines) {
      if (line.startsWith('> ')) {
        flushPara()
        para = []
        quote.push(line.slice(2))
      } else {
        flushQuote()
        quote = []
        if (line || para.length) para.push(line)
      }
    }
    flushQuote()
    flushPara()
    if (i + 2 < parts.length) blocks.push({ type: 'pre', lang: parts[i + 1], code: parts[i + 2] })
  }
  return blocks
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) =>
      n.type === 'text' || n.type === 'code'
        ? n.text
        : n.type === 'hashtag'
          ? `#${n.tag}`
          : n.type === 'emoji'
            ? n.alt
          : n.type === 'br'
            ? '\n'
            : inlineText(n.children),
    )
    .join('')
}

export function toPlain(source: string): string {
  return parse(source)
    .map((b) => (b.type === 'pre' ? b.code : inlineText(b.children)))
    .join('\n')
}

function Spoiler({ children }: { children: ComponentChildren }) {
  const [shown, setShown] = useState(false)
  return (
    <span class={shown ? 'spoiler shown' : 'spoiler'} onClick={() => setShown(true)}>
      {children}
    </span>
  )
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  const ui = useContext(Ui)
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return n.text
          case 'br':
            return <br key={i} />
          case 'code':
            return (
              <code key={i} class="mono" onClick={() => ui.copy(n.text)}>
                {n.text}
              </code>
            )
          case 'bold':
            return (
              <b key={i}>
                <Inlines nodes={n.children} />
              </b>
            )
          case 'italic':
            return (
              <i key={i}>
                <Inlines nodes={n.children} />
              </i>
            )
          case 'spoiler':
            return (
              <Spoiler key={i}>
                <Inlines nodes={n.children} />
              </Spoiler>
            )
          case 'emoji':
            return <CustomEmoji key={i} id={n.id} alt={n.alt} />
          case 'hashtag':
            return (
              <a key={i} class="link" href={`#${n.tag}`} onClick={(e) => (e.preventDefault(), ui.search(`#${n.tag}`))}>
                #{n.tag}
              </a>
            )
          case 'link':
            return n.href.startsWith('/') ? (
              <Link key={i} class="link" href={n.href}>
                <Inlines nodes={n.children} />
              </Link>
            ) : (
              <a key={i} class="link" href={n.href} target="_blank" rel="noopener noreferrer">
                <Inlines nodes={n.children} />
              </a>
            )
        }
      })}
    </>
  )
}

function Pre({ lang, code }: { lang: string; code: string }) {
  const ui = useContext(Ui)
  const html = useMemo(
    () => (lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : null),
    [lang, code],
  )
  return (
    <div class="pre">
      <div class="pre-head">
        <span>{lang === 'ts' ? 'typescript' : lang}</span>
        <button onClick={() => ui.copy(code)}>copy</button>
      </div>
      {html ? (
        <pre class="mono" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre class="mono">{code}</pre>
      )}
    </div>
  )
}

export function Markup({ source }: { source: string }) {
  const blocks = useMemo(() => parse(source), [source])
  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'pre' ? (
          <Pre key={i} lang={b.lang} code={b.code} />
        ) : b.type === 'quote' ? (
          <blockquote key={i}>
            <Inlines nodes={b.children} />
          </blockquote>
        ) : (
          <p key={i}>
            <Inlines nodes={b.children} />
          </p>
        ),
      )}
    </>
  )
}

export const escape = (text: string) => text.replace(/[\\`*_|[\]#>]/g, '\\$&')
