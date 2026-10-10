import { createContext } from 'preact'

export type Photo = { src: string; alt: string; caption?: string }

export const Ui = createContext({
  search: (_query: string, _scope?: string) => {},
  view: (_photo: Photo) => {},
  copy: (_text: string) => {},
})
