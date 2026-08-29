# In Their World

An interactive field guide for parents & teachers — four short simulations
(autism, ADHD, dyslexia, speech/language) paired with real prevalence data
and practical strategies.

## About

Reading a checklist about autism, ADHD, dyslexia, or a speech/language
difference tells you the facts — it doesn't tell you what a child's morning
actually feels like. **In Their World** is four short simulations, one per
condition, that put a parent or teacher inside that experience for a few
minutes: sounds you can't tune out, focus that keeps slipping, letters that
won't sit still, words that won't come out in time. Most parents and
teachers don't get long before they need to understand — this is meant to
be a five-minute way in.

Each module follows the same shape:

- **Feel it first** — a short interactive task simulates the actual
  friction, rather than describing it.
- **See the numbers** — Indian prevalence data and context, so the scale
  feels real rather than abstract.
- **Know what helps** — concrete, low-effort strategies for home and
  classroom, not just awareness.

The data behind each module is deliberately Indian, not imported. Most
awareness material in this space is built on US or UK prevalence numbers
that don't map cleanly onto a country where diagnosis is far less common
and often comes late. Figures here are drawn from the Dyslexia Association
of India, AIISH, and INCLEN Trust / PLOS Medicine studies instead.

Built to build empathy, not to diagnose — it's not a clinical or
diagnostic tool.

Made by [Manas Learning](https://www.manaslearning.com), for the parents
and teachers who want a starting point, not a stereotype.

## Run it

```bash
npm install
npm run dev       # local dev server, with hot reload
npm run build     # production build → dist/
npm run preview   # preview the production build
```

Requires Node 18+.

## Structure
index.html entry HTML (loads fonts, mounts #root)
src/main.jsx React entry point
src/App.jsx thin wrapper around the component
src/InTheirWorld.jsx the whole experience: landing + 4 modules
src/InTheirWorld.css all styling, scoped under .itw-root

No backend — everything runs client-side. To embed this inside a larger
site, import `InTheirWorld` from `src/InTheirWorld.jsx` and drop
`<InTheirWorld />` anywhere; the `.itw-root` wrapper keeps its styles from
leaking out.
