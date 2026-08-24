# In Their World

An interactive field guide for parents & teachers — four short simulations
(autism, ADHD, dyslexia, speech/language) paired with real prevalence data
and practical strategies.

## Run it

```bash
npm install
npm run dev       # local dev server, with hot reload
npm run build     # production build → dist/
npm run preview   # preview the production build
```

Requires Node 18+.

## Structure

```
index.html            entry HTML (loads fonts, mounts #root)
src/main.jsx           React entry point
src/App.jsx             thin wrapper around the component
src/InTheirWorld.jsx    the whole experience: landing + 4 modules
src/InTheirWorld.css    all styling, scoped under .itw-root
```

No backend — everything runs client-side. To embed this inside a larger
site, import `InTheirWorld` from `src/InTheirWorld.jsx` and drop `<InTheirWorld />`
anywhere; the `.itw-root` wrapper keeps its styles from leaking out.
