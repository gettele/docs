import { render } from 'preact'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import '@fontsource/open-sans/700.css'
import { App } from './app'
import './app.css'

render(<App />, document.getElementById('app')!)
