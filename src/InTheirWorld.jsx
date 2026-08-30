import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  createContext,
} from "react";
import "./InTheirWorld.css";

/* ============================================================
   In Their World
   A field guide for parents & teachers — four short interactive
   simulations (autism, ADHD, dyslexia, speech/language), each
   framed as a task you attempt and get rated on, with synthesized
   ambient audio, plus real prevalence data (US/global AND India)
   and practical strategies.

   Drop-in usage:
     import InTheirWorld from "./InTheirWorld";
     <InTheirWorld />
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Smoothly scroll a section into view by id — used by the module TOC and by
   the facts conveyor once it's cycled through everything. */
function scrollToId(id) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const ACCENT_HEX = {
  landing: "44,140,114",
  autism: "44,140,114",
  adhd: "140,101,32",
  dyslexia: "89,40,140",
  speech: "140,66,44",
};
const ACCENT_HEX_DARK = {
  landing: "86,210,177",
  autism: "86,210,177",
  adhd: "210,160,86",
  dyslexia: "144,86,210",
  speech: "210,115,86",
};

/* ---------------- Settings context (sound) ---------------- */

const SettingsContext = createContext({ soundOn: true });

/* ---------------- Audio engine (Web Audio API, no external assets) ---------------- */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.drones = new Map();
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  tone({ freq = 440, type = "sine", duration = 0.2, gain = 0.14, detune = 0, delay = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(this.master);
    const start = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  sweep({ from = 800, to = 200, duration = 0.35, type = "sawtooth", gain = 0.12 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), ctx.currentTime + duration);
    g.gain.value = 0;
    osc.connect(g);
    g.connect(this.master);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  noiseBurst({ duration = 0.25, gain = 0.09, filterFreq = 1800, type = "bandpass" } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start();
  }

  startDrone(id, { freqs = [110, 165], type = "sawtooth" } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.drones.has(id)) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.master);
    const oscs = freqs.map((f) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    this.drones.set(id, { g, oscs });
  }

  setDroneGain(id, value) {
    const d = this.drones.get(id);
    if (!d) return;
    const ctx = this.ctx;
    if (!ctx) return;
    d.g.gain.linearRampToValueAtTime(Math.max(0.0001, value), ctx.currentTime + 0.15);
  }

  stopDrone(id) {
    const d = this.drones.get(id);
    if (!d) return;
    d.oscs.forEach((o) => {
      try {
        o.stop();
      } catch (e) {
        /* already stopped */
      }
    });
    this.drones.delete(id);
  }

  // A short, distinct sound tied to a *specific* sensory event (a chair
  // scraping, a laugh, a slammed door) rather than generic static — each
  // kind gets its own small signature built from the primitives above.
  cue(kind, gain = 1) {
    const g = Math.max(0.15, Math.min(1.4, gain));
    switch (kind) {
      case "laugh":
        this.tone({ freq: 500, type: "triangle", duration: 0.09, gain: 0.12 * g });
        this.tone({ freq: 640, type: "triangle", duration: 0.09, gain: 0.12 * g, delay: 0.1 });
        this.tone({ freq: 580, type: "triangle", duration: 0.13, gain: 0.11 * g, delay: 0.21 });
        break;
      case "bell":
        this.tone({ freq: 1050, type: "sine", duration: 0.35, gain: 0.14 * g });
        this.tone({ freq: 1050, type: "sine", duration: 0.3, gain: 0.1 * g, delay: 0.38 });
        break;
      case "scrape":
      case "screech":
        this.sweep({ from: 900, to: 2600, duration: 0.35, type: "sawtooth", gain: 0.11 * g });
        break;
      case "buzzphone":
        for (let i = 0; i < 5; i++) this.tone({ freq: 180, type: "square", duration: 0.05, gain: 0.07 * g, delay: i * 0.06 });
        break;
      case "slam":
        this.noiseBurst({ duration: 0.18, gain: 0.16 * g, filterFreq: 400, type: "lowpass" });
        break;
      case "crash":
        this.noiseBurst({ duration: 0.28, gain: 0.13 * g, filterFreq: 2600, type: "highpass" });
        break;
      case "shout":
        this.noiseBurst({ duration: 0.2, gain: 0.12 * g, filterFreq: 1200 });
        this.tone({ freq: 300, type: "sawtooth", duration: 0.22, gain: 0.1 * g, delay: 0.02 });
        break;
      case "whir":
      case "hum":
        this.tone({ freq: 150, type: "sawtooth", duration: 0.5, gain: 0.06 * g });
        break;
      case "footsteps":
        this.tone({ freq: 90, type: "triangle", duration: 0.09, gain: 0.1 * g });
        this.tone({ freq: 90, type: "triangle", duration: 0.09, gain: 0.1 * g, delay: 0.28 });
        break;
      case "argue":
        this.tone({ freq: 340, type: "square", duration: 0.12, gain: 0.08 * g });
        this.tone({ freq: 420, type: "square", duration: 0.12, gain: 0.08 * g, delay: 0.1 });
        break;
      case "rustle":
        this.noiseBurst({ duration: 0.14, gain: 0.05 * g, filterFreq: 3400, type: "highpass" });
        break;
      case "tray":
        this.noiseBurst({ duration: 0.3, gain: 0.14 * g, filterFreq: 2200, type: "bandpass" });
        break;
      case "tap":
        this.tone({ freq: 900, type: "square", duration: 0.03, gain: 0.06 * g });
        this.tone({ freq: 900, type: "square", duration: 0.03, gain: 0.06 * g, delay: 0.14 });
        break;
      case "call":
        this.tone({ freq: 500, type: "sine", duration: 0.18, gain: 0.1 * g });
        this.tone({ freq: 500, type: "sine", duration: 0.18, gain: 0.1 * g, delay: 0.35 });
        break;
      case "flicker":
        this.tone({ freq: 2200, type: "square", duration: 0.02, gain: 0.03 * g });
        this.tone({ freq: 2200, type: "square", duration: 0.02, gain: 0.03 * g, delay: 0.08 });
        break;
      default:
        this.noiseBurst({ duration: 0.15, gain: 0.08 * g });
    }
  }
}

const audio = new AudioEngine();

function speakText(text, { rate = 1, pitch = 1, volume = 0.85 } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* speech synthesis unavailable — visual/audio-tone feedback still works */
  }
}

/* ---------------- Landing ---------------- */

const MODULES = [
  {
    key: "autism",
    tag: "Sensory input",
    name: "Autism",
    blurb: "Sensory processing, filtering, and why a “normal” room can feel like too much.",
    statBig: "~1 in 100",
    statRest: "children under 10 in India (INCLEN Trust, PLOS Medicine)",
  },
  {
    key: "adhd",
    tag: "Sustained focus",
    name: "ADHD",
    blurb: "What it takes to hold attention on one task while everything else pulls at you.",
    statBig: "~7.1%",
    statRest: "pooled prevalence, Indian children & adolescents (19-study meta-analysis)",
  },
  {
    key: "dyslexia",
    tag: "Reading & decoding",
    name: "Dyslexia",
    blurb: "Decoding text when letters won't sit still and reading takes real effort, every line.",
    statBig: "10–15%",
    statRest: "of Indian children, estimated dyslexic (Dyslexia Association of India)",
  },
  {
    key: "speech",
    tag: "Finding the words",
    name: "Speech & Language",
    blurb: "Knowing exactly what you want to say — and having the words arrive late, or not at all.",
    statBig: "~1 in 11",
    statRest: "at-risk children found to have one on evaluation (Indian rural screening study)",
  },
];

const MODULE_ICONS = {
  autism: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 20c3-7 7-7 8 0s5 7 8 0 5-7 8 0 3 7 4 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  adhd: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="4.5" fill="currentColor" />
      <path d="M20 4v7M20 29v7M4 20h7M29 20h7M9 9l5 5M26 26l5 5M31 9l-5 5M14 26l-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
  dyslexia: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="7" y="27" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="22" fill="currentColor">b</text>
      <text x="20" y="27" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="22" fill="currentColor" transform="scale(-1,1) translate(-40,0)">b</text>
    </svg>
  ),
  speech: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 12a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H16l-6 6v-6a4 4 0 0 1-2-3.4V12Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 17h12M14 21h7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
};

/* A tiny fake mouse pointer that drifts to a target and "clicks" it, on a
   loop — this is what stands in for the idle/resting state of each sim,
   so the resting card demonstrates how the task is actually played
   instead of just showing a frozen scene. */
function DemoCursor({ variant }) {
  return (
    <span className={`itw-cp-cursor itw-cp-cursor-${variant}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 3l14 6.2-5.6 2.1L10 17 4 3Z" fill="#fff" stroke="#2a2a28" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="itw-cp-click-ring" />
    </span>
  );
}

/* A tiny, auto-playing, DOM-built preview of each module's core moment —
   answers "what does this look like" without a video file to host or load.
   Doubles as the idle demo: a cursor visibly moves in and clicks the thing
   you'd click, on loop, so the resting state teaches the mechanic. */
function CardPreview({ moduleKey }) {
  if (moduleKey === "autism") {
    return (
      <div className="itw-cp-stage">
        <span className="itw-cp-dot itw-cp-target" />
        <span className="itw-cp-dot itw-cp-decoy" style={{ top: "62%", left: "58%" }} />
        <span className="itw-cp-dot itw-cp-decoy" style={{ top: "70%", left: "18%", animationDelay: ".35s" }} />
        <span className="itw-cp-chip">🪑 chair scraping</span>
        <DemoCursor variant="autism" />
      </div>
    );
  }
  if (moduleKey === "adhd") {
    return (
      <div className="itw-cp-stage">
        <span className="itw-cp-num">4</span>
        <span className="itw-cp-num itw-cp-num-2">7</span>
        <span className="itw-cp-bubble">New message!</span>
        <DemoCursor variant="adhd" />
      </div>
    );
  }
  if (moduleKey === "dyslexia") {
    return (
      <div className="itw-cp-stage itw-cp-stage-text">
        <span className="itw-cp-word">
          {"b/d p/q".split("").map((ch, i) => (
            <span key={i} className="itw-cp-letter" style={{ animationDelay: `${i * 0.12}s` }}>
              {ch}
            </span>
          ))}
        </span>
        <DemoCursor variant="dyslexia" />
      </div>
    );
  }
  // speech
  return (
    <div className="itw-cp-stage itw-cp-stage-text">
      <span className="itw-cp-word">
        I w<span className="itw-cp-blocked">-w-w</span>ant to...
      </span>
      <DemoCursor variant="speech" />
    </div>
  );
}

function Landing({ onSelect }) {
  return (
    <section className="itw-view">
      <div className="itw-blob itw-blob-1" />
      <div className="itw-blob itw-blob-2" />
      <div className="itw-blob itw-blob-3" />
      <div className="itw-masthead">
        <div className="itw-eyebrow itw-rise itw-rise-1">Experience What They Feel</div>
        <h1 className="itw-title itw-rise itw-rise-2">
          Step into their <span className="itw-accent-word">world<svg className="itw-squiggle" viewBox="0 0 160 14" preserveAspectRatio="none"><path d="M2 9c14-10 26-10 40 0s26 10 40 0 26-10 40 0 26 10 36 2" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/></svg></span>,<br />just for a few minutes.
        </h1>
        <p className="itw-lede itw-rise itw-rise-3">
          Four short, hands-on experiences that simulate what focus, reading, sensory
          input, and speaking out loud can feel like for kids with autism, ADHD, dyslexia,
          or a speech difference — each one a small task you try yourself, paired with
          real data and practical steps you can use right away.
        </p>
        <div className="itw-disclaimer itw-rise itw-rise-4">
          <strong>Before you start:</strong> these are approximations for empathy, not diagnoses — every child's experience is their own.
        </div>
      </div>

      <div className="itw-roadmap itw-rise itw-rise-5" aria-hidden="true">
        <div className="itw-roadmap-path" />
        {MODULES.map((m, i) => (
          <div className="itw-roadmap-stop" key={m.key} style={{ "--stop-accent": `var(--itw-${m.key})` }}>
            <span className="itw-roadmap-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="itw-roadmap-label">{m.name}</span>
          </div>
        ))}
      </div>
      <div className="itw-bento itw-rise itw-rise-5">
        {MODULES.map((m, i) => (
          <button key={m.key} className={`itw-mcard itw-bento-${i}`} data-m={m.key} onClick={() => onSelect(m.key)}>
            <div className="itw-mcard-body">
              <div className="itw-mcard-top">
                <div className="itw-mcard-icon">{MODULE_ICONS[m.key]}</div>
                <div className="itw-tag">{m.tag}</div>
              </div>
              <h3>{m.name}</h3>
              <p>{m.blurb}</p>
              <div className="itw-cp-label">
                How it plays <span className="itw-cp-live" />
              </div>
              <div className="itw-card-preview">
                <CardPreview moduleKey={m.key} />
              </div>
              <div className="itw-mcard-bottom">
                <div className="itw-stat">
                  <b>{m.statBig}</b>
                  <span>{m.statRest}</span>
                </div>
                <div className="itw-enter">
                  Try it
                  <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <AboutBlock />

      <div className="itw-foot-note">
        Built to build empathy, not to diagnose. Figures are approximate and drawn from the Dyslexia
        Association of India, AIISH, INCLEN Trust / PLOS Medicine, and peer-reviewed Indian epidemiological studies.
      </div>
    </section>
  );
}

function AboutBlock() {
  return (
    <div className="itw-about itw-rise itw-rise-5">
      <div className="itw-about-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
      </div>
      <div>
        <h3>About In Their World</h3>
        <p>
          Reading a checklist about autism, ADHD, dyslexia, or a speech/language difference tells you
          the facts — it doesn't tell you what your child's morning actually feels like. In Their World
          is four short simulations, one per condition, that put you inside that experience for a few
          minutes: sounds you can't tune out, focus that keeps slipping, letters that won't sit still,
          words that won't come out in time. Most parents and teachers don't get long before they need
          to understand — this is a five-minute way in.
        </p>
        <p>
          The data behind each module is deliberately Indian, not imported. Most awareness material
          in this space is built on US or UK prevalence numbers that don't map cleanly onto a country
          where diagnosis is far less common and often comes late. Figures here are drawn from the
          Dyslexia Association of India, AIISH, and INCLEN Trust / PLOS Medicine studies instead.
        </p>
        <ul className="itw-about-points">
          <li>
            <b>Feel it first</b>
            A short interactive task simulates the actual friction — not a description of it.
          </li>
          <li>
            <b>See the numbers</b>
            Indian prevalence data and context, so the scale feels real rather than abstract.
          </li>
          <li>
            <b>Know what helps</b>
            Concrete, low-effort strategies for home and classroom, not just awareness.
          </li>
        </ul>
        <p className="itw-brand-echo">EveryChildLearnsDifferently.</p>
        <p>
          Made by <a href="https://www.manaslearning.com" target="_blank" rel="noreferrer">Manas Learning</a>,
          for the parents and teachers who want a starting point, not a stereotype.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Shared module shell ---------------- */

function SettingsBar({ soundOn, setSoundOn, darkMode, setDarkMode }) {
  return (
    <div className="itw-settings-bar">
      <button
        type="button"
        className={`itw-toggle-btn${darkMode ? " itw-active" : ""}`}
        aria-pressed={darkMode}
        onClick={() => setDarkMode((v) => !v)}
      >
        {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}
      </button>
      <button
        type="button"
        className={`itw-toggle-btn${soundOn ? " itw-active" : ""}`}
        aria-pressed={soundOn}
        onClick={() => setSoundOn((v) => !v)}
      >
        {soundOn ? "🔊 Sound on" : "🔇 Sound off"}
      </button>
    </div>
  );
}

function StrategyTabs({ home, classroom }) {
  const [tab, setTab] = useState("home");
  return (
    <>
      <div className="itw-strat-tabs">
        <button
          className={`itw-btn-ghost${tab === "home" ? " itw-active" : ""}`}
          onClick={() => setTab("home")}
        >
          At home
        </button>
        <button
          className={`itw-btn-ghost${tab === "class" ? " itw-active" : ""}`}
          onClick={() => setTab("class")}
        >
          In the classroom
        </button>
      </div>
      <ul className="itw-strat-list">
        {(tab === "home" ? home : classroom).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </>
  );
}

/* A conveyor belt of facts: one at a time, popping in big and bright, then
   sliding off to make way for the next. Cycles through the whole set once
   and fires onComplete — used to auto-scroll down to "how you can help". */
function FactsConveyor({ facts, onComplete }) {
  const { soundOn } = useContext(SettingsContext);
  const [idx, setIdx] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [tapPaused, setTapPaused] = useState(false); // touch has no hover, so tapping the card toggles this instead
  const paused = hoverPaused || tapPaused;
  const completedRef = useRef(false);

  // Reset only when the actual fact set changes (e.g. US/India toggle) —
  // not on every unrelated re-render, since the facts array is a fresh
  // literal each time the parent renders.
  const factsKey = facts.map((f) => f.num).join("|");
  useEffect(() => {
    completedRef.current = false;
    setTapPaused(false);
    setIdx(0);
  }, [factsKey]);

  // Read each fact aloud as it comes up on the belt, if sound is on.
  useEffect(() => {
    if (!soundOn) return;
    const f = facts[idx];
    if (!f) return;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    speakText(`${f.num}. ${f.label}`, { rate: 1.02, volume: 0.55 });
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, soundOn, factsKey]);

  const handleEnd = () => {
    if (paused) return;
    if (idx === facts.length - 1) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete && onComplete();
      }
      setIdx(0);
    } else {
      setIdx((i) => i + 1);
    }
  };

  const jump = (i) => {
    completedRef.current = true; // manual browsing shouldn't re-trigger the auto-scroll
    setIdx(i);
  };
  const prev = () => jump((idx - 1 + facts.length) % facts.length);
  const next = () => jump((idx + 1) % facts.length);
  const toggleTapPause = () => setTapPaused((v) => !v);

  const f = facts[idx];

  return (
    <div
      className="itw-conveyor"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
    >
      <button
        type="button"
        className="itw-conveyor-arrow itw-conveyor-arrow-prev"
        aria-label="Previous fact"
        onClick={prev}
      >
        <svg viewBox="0 0 20 20" fill="none"><path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div
        className="itw-conveyor-track"
        role="button"
        tabIndex={0}
        aria-pressed={tapPaused}
        aria-label={tapPaused ? "Resume auto-advancing facts" : "Pause auto-advancing facts"}
        onClick={toggleTapPause}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleTapPause())}
      >
        <div
          key={idx}
          className={`itw-conveyor-card${paused ? " itw-conveyor-paused" : ""}`}
          onAnimationEnd={handleEnd}
        >
          <div className="itw-conveyor-num">{f.num}</div>
          <div className="itw-conveyor-lbl">{f.label}</div>
          <div className="itw-conveyor-src">{f.src}</div>
        </div>
        {tapPaused && (
          <div className="itw-conveyor-paused-badge" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor"/><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor"/></svg>
            paused — tap to resume
          </div>
        )}
      </div>
      <button
        type="button"
        className="itw-conveyor-arrow itw-conveyor-arrow-next"
        aria-label="Next fact"
        onClick={next}
      >
        <svg viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div className="itw-conveyor-dots">
        {facts.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show fact ${i + 1} of ${facts.length}`}
            className={i === idx ? "itw-active" : ""}
            onClick={() => jump(i)}
          />
        ))}
      </div>
    </div>
  );
}

function FactsGrid({ facts, note, onComplete }) {
  return (
    <>
      <FactsConveyor facts={facts} onComplete={onComplete} />
      {note && <p className="itw-fact-note">{note}</p>}
    </>
  );
}

function ModuleSwitcher({ current, onNavigate }) {
  return (
    <div className="itw-switch" role="tablist" aria-label="Jump to another module">
      {MODULES.map((m) => (
        <button
          key={m.key}
          role="tab"
          aria-selected={current === m.key}
          aria-label={m.name}
          title={m.name}
          className={current === m.key ? "itw-current" : ""}
          onClick={() => current !== m.key && onNavigate(m.key)}
        />
      ))}
    </div>
  );
}

function ModuleTOC({ sections }) {
  if (!sections || !sections.length) return null;
  return (
    <nav className="itw-toc" aria-label="Jump to a section">
      <span className="itw-toc-label">Jump to</span>
      <div className="itw-toc-items">
        {sections.map((s, i) => (
          <button key={s.id} type="button" className="itw-toc-item" onClick={() => scrollToId(s.id)}>
            <span className="itw-toc-num">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ModuleShell({ accent, eyebrow, title, dek, sections, onBack, onNavigate, children }) {
  return (
    <section className="itw-view itw-module" data-accent={accent}>
      <div className="itw-module-top">
        <button className="itw-back-btn" onClick={onBack}>
          ← All modules
        </button>
        <ModuleSwitcher current={accent} onNavigate={onNavigate} />
      </div>
      <div className="itw-module-head">
        <div className="itw-eyebrow">{eyebrow}</div>
        <h2 className="itw-mtitle">{title}</h2>
        <p className="itw-module-dek">{dek}</p>
      </div>
      <ModuleTOC sections={sections} />
      <div className="itw-mpreview" aria-hidden="true">
        <div className="itw-cp-label">
          How it plays — watch, then try it yourself <span className="itw-cp-live" />
        </div>
        <div className="itw-card-preview itw-card-preview-lg">
          <CardPreview moduleKey={accent} />
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------------- Viewfinder (signature element — the "step into their
   world" viewport, with a live HUD readout, wraps every sim stage) ---------------- */

function Viewfinder({ hud, stageStyle, children }) {
  return (
    <div className="itw-viewfinder">
      <div className="itw-viewfinder-stage itw-sim-stage" style={stageStyle}>
        <div className="itw-vf-corner itw-vf-tl" />
        <div className="itw-vf-corner itw-vf-tr" />
        <div className="itw-vf-corner itw-vf-bl" />
        <div className="itw-vf-corner itw-vf-br" />
        <div className="itw-viewfinder-hud">
          <span className="itw-hud-rec">
            <span className="itw-hud-dot" />
            {(hud && hud.left) || "Take your time"}
          </span>
          <span>{(hud && hud.right) || ""}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Rating card (shared by every task) ---------------- */

function RatingCard({ title, lines, retryLabel = "Try again", onRetry }) {
  useEffect(() => {
    audio.tone({ freq: 523, type: "sine", duration: 0.16, gain: 0.1 });
    audio.tone({ freq: 659, type: "sine", duration: 0.2, gain: 0.09, delay: 0.09 });
  }, []);
  return (
    <div className="itw-rating-card" role="status">
      <div className="itw-rating-top">
        <div className="itw-rating-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
        </div>
        <div className="itw-rating-title">{title}</div>
      </div>
      <ul className="itw-rating-lines">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <button className="itw-btn-ghost itw-rating-retry" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

/* ---------------- How-to strip (3 short steps, shown before every task) ---------------- */

function HowTo({ steps }) {
  return (
    <div className="itw-howto">
      {steps.map((s, i) => (
        <div className="itw-howto-step" key={i}>
          <span className="itw-howto-num">{i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}

/* ================= AUTISM: sensory overload simulator ================= */

// Concrete sensory events, each with its own icon and its own synthesized
// sound (see AudioEngine.cue) — this is what's actually competing for
// attention, not abstract static.
const SOUND_EVENTS = [
  { text: "chair scraping", icon: "🪑", kind: "scrape" },
  { text: "someone's laughing", icon: "😄", kind: "laugh" },
  { text: "the light is humming", icon: "💡", kind: "hum" },
  { text: "bell in 3...2...", icon: "🔔", kind: "bell" },
  { text: "LOOK AT ME WHEN I TALK", icon: "📢", kind: "shout" },
  { text: "the fan is loud", icon: "🌀", kind: "whir" },
  { text: "papers rustling", icon: "📄", kind: "rustle" },
  { text: "someone dropped a tray", icon: "🍽️", kind: "tray" },
  { text: "someone's phone buzzing", icon: "📳", kind: "buzzphone" },
  { text: "footsteps behind you", icon: "👣", kind: "footsteps" },
  { text: "chalk squeaking", icon: "✏️", kind: "screech" },
  { text: "two kids arguing", icon: "🗣️", kind: "argue" },
  { text: "door slamming", icon: "🚪", kind: "slam" },
  { text: "your name, called twice", icon: "🙋", kind: "call" },
  { text: "fluorescent flicker", icon: "💡", kind: "flicker" },
  { text: "pencil tapping", icon: "✏️", kind: "tap" },
];

const TOTAL_ROUNDS = 8;
const ROUND_TIME_LIMIT = (round) => Math.max(1.1, 2.8 - round * 0.22);

function AutismSim() {
  const { soundOn } = useContext(SettingsContext);
  const [phase, setPhase] = useState("intro"); // intro | task | done
  const [filter, setFilter] = useState(10); // exploration-only, before the graded task starts
  const [round, setRound] = useState(0);
  const [targetPos, setTargetPos] = useState({ top: 50, left: 50 });
  const [decoys, setDecoys] = useState([]);
  const [misses, setMisses] = useState(0);
  const [timeouts, setTimeouts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [rating, setRating] = useState(null);

  const roundStartRef = useRef(0);
  const timeAccRef = useRef(0);
  const missesRef = useRef(0);
  const timeoutsRef = useRef(0);
  const decoyIdRef = useRef(0);
  const timerRafRef = useRef(null);
  const roundLimitRef = useRef(0);

  const practiceIntensity = (100 - filter) / 100;
  const taskIntensity = Math.min(1.15, 0.35 + (round - 1) * 0.14);
  const intensity = phase === "task" ? taskIntensity : practiceIntensity;
  const camouflage = phase === "task" ? Math.min(0.85, Math.max(0, (round - 2) * 0.16)) : 0;

  // Sensory-event chips: each pops in with an icon + its actual label
  // ("chair scraping", "someone's laughing"...) and fires its own matching
  // synthesized sound. Spawn rate and loudness scale with intensity — this
  // stands in for the abstract "static" the old version showed.
  const [cues, setCues] = useState([]);
  const cueIdRef = useRef(0);
  const cueTimeoutsRef = useRef([]);
  const intensityBucket = Math.round(intensity * 10);

  useEffect(() => {
    cueTimeoutsRef.current.forEach(clearTimeout);
    cueTimeoutsRef.current = [];
    if (phase === "done") return;
    let cancelled = false;
    const spawn = () => {
      if (cancelled) return;
      const evt = SOUND_EVENTS[Math.floor(Math.random() * SOUND_EVENTS.length)];
      const id = cueIdRef.current++;
      const top = 8 + Math.random() * 74;
      const left = 4 + Math.random() * 76;
      setCues((prev) => [...prev.slice(-6), { id, ...evt, top, left }]);
      if (soundOn) audio.cue(evt.kind, 0.4 + (intensityBucket / 10) * 0.9);
      const life = setTimeout(() => {
        setCues((prev) => prev.filter((c) => c.id !== id));
      }, 1500 + Math.random() * 600);
      const delay = Math.max(240, 1500 - (intensityBucket / 10) * 1150 + Math.random() * 450);
      const next = setTimeout(spawn, delay);
      cueTimeoutsRef.current.push(life, next);
    };
    const kick = setTimeout(spawn, 260);
    cueTimeoutsRef.current.push(kick);
    return () => {
      cancelled = true;
      cueTimeoutsRef.current.forEach(clearTimeout);
      cueTimeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, intensityBucket, soundOn]);

  useEffect(() => {
    if (!soundOn) {
      audio.stopDrone("autism");
      return;
    }
    audio.startDrone("autism", { freqs: [98, 147, 201, 302], type: "sawtooth" });
    return () => audio.stopDrone("autism");
  }, [soundOn]);

  useEffect(() => {
    audio.setDroneGain("autism", soundOn ? intensity * 0.055 : 0.0001);
  }, [intensity, soundOn]);

  const readout =
    phase === "task"
      ? round >= 5
        ? "Full overload — this is what an unfiltered classroom feels like on its worst day. Find the real target anyway, before time runs out."
        : "Noise climbs and time shrinks every round, on its own. There's no slider now — this is the part that doesn't turn down on demand."
      : filter < 25
      ? "This is closer to a packed classroom during free time — bright lights, side conversations, a chair scraping."
      : filter < 55
      ? "Partial filtering — like stepping into a slightly quieter hallway, but the noise hasn't gone away."
      : filter < 85
      ? "This is closer to what noise-reducing headphones and dimmer lighting can offer."
      : "This is what a genuinely quiet, low-stimulation space feels like — the task hasn't changed, only the ability to focus on it.";

  const randPos = (avoid) => {
    let top, left, ok;
    do {
      top = 8 + Math.random() * 76;
      left = 6 + Math.random() * 80;
      ok = true;
      for (const p of avoid) {
        if (Math.abs(p.top - top) < 15 && Math.abs(p.left - left) < 15) ok = false;
      }
    } while (!ok);
    return { top, left };
  };

  const clearTimer = () => {
    if (timerRafRef.current) {
      clearInterval(timerRafRef.current);
      timerRafRef.current = null;
    }
  };

  const setupRound = (roundNum) => {
    const t = randPos([]);
    const decoyCount = roundNum >= 6 ? 5 : roundNum >= 4 ? 4 : roundNum >= 2 ? 3 : 2;
    const avoid = [t];
    const nd = [];
    for (let i = 0; i < decoyCount; i++) {
      const p = randPos(avoid);
      avoid.push(p);
      nd.push({ id: decoyIdRef.current++, ...p });
    }
    setTargetPos(t);
    setDecoys(nd);
    roundStartRef.current = performance.now();
    const limit = ROUND_TIME_LIMIT(roundNum);
    roundLimitRef.current = limit;
    setTimeLeft(limit);
    clearTimer();
    timerRafRef.current = setInterval(() => {
      const elapsed = (performance.now() - roundStartRef.current) / 1000;
      const remaining = limit - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        clearTimer();
        timeoutsRef.current += 1;
        setTimeouts(timeoutsRef.current);
        missesRef.current += 1;
        setMisses(missesRef.current);
        if (soundOn) audio.sweep({ from: 260, to: 90, duration: 0.3, type: "sawtooth", gain: 0.09 });
        advanceRound(roundNum);
      } else {
        setTimeLeft(remaining);
      }
    }, 60);
  };

  const advanceRound = (finishedRound) => {
    if (finishedRound >= TOTAL_ROUNDS) {
      clearTimer();
      const totalTime = timeAccRef.current;
      const avgTime = totalTime / (TOTAL_ROUNDS - timeoutsRef.current || 1);
      const speedScore = Math.max(0, 100 - avgTime * 22);
      const missPenalty = missesRef.current * 11 + timeoutsRef.current * 6;
      const score = Math.round(Math.max(0, Math.min(100, speedScore - missPenalty + 6)));
      setPhase("done");
      setRating({ score, time: totalTime.toFixed(1), misses: missesRef.current, timeouts: timeoutsRef.current });
    } else {
      const next = finishedRound + 1;
      setRound(next);
      setupRound(next);
    }
  };

  const startTask = () => {
    timeAccRef.current = 0;
    missesRef.current = 0;
    timeoutsRef.current = 0;
    setMisses(0);
    setTimeouts(0);
    setRating(null);
    setPhase("task");
    setRound(1);
    setupRound(1);
  };

  const clickTarget = () => {
    if (phase !== "task") return;
    const elapsed = (performance.now() - roundStartRef.current) / 1000;
    timeAccRef.current += elapsed;
    clearTimer();
    if (soundOn) audio.tone({ freq: 700, type: "sine", duration: 0.16, gain: 0.13 });
    advanceRound(round);
  };

  const clickDecoy = () => {
    if (phase !== "task") return;
    missesRef.current += 1;
    setMisses(missesRef.current);
    if (soundOn) audio.sweep({ from: 500, to: 150, duration: 0.2, type: "sawtooth", gain: 0.1 });
  };

  const retry = () => {
    clearTimer();
    setPhase("intro");
    setRound(0);
    setRating(null);
  };

  useEffect(() => clearTimer, []);

  const timerPct = roundLimitRef.current ? Math.max(0, Math.min(100, (timeLeft / roundLimitRef.current) * 100)) : 100;
  const targetColor = camouflage > 0 ? `rgba(229,72,77,${(1 - camouflage * 0.75).toFixed(2)})` : undefined;

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Find the one real dot among the decoys, {TOTAL_ROUNDS} rounds — it only gets louder from here.
      </div>
      <HowTo
        steps={[
          "Spot the one real dot",
          "Click it before time runs out",
          "Noise & decoys ramp up each round",
        ]}
      />
      <Viewfinder
        hud={{
          left: phase === "task" ? `ROUND ${round}/${TOTAL_ROUNDS}` : "STANDBY",
          right: `${Math.round(intensity * 100)}% NOISE`,
        }}
      >
        {phase === "task" && (
          <div className="itw-round-timer">
            <div className="itw-round-timer-fill" style={{ width: `${timerPct}%` }} />
          </div>
        )}
        {phase !== "task" && (
          <div
            className="itw-sensory-target"
            style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", cursor: "default" }}
          >
            <div className="itw-dot" />
            <p>press start below</p>
          </div>
        )}
        {phase === "task" && (
          <>
            <div
              className="itw-sensory-target"
              role="button"
              tabIndex={0}
              style={{ top: `${targetPos.top}%`, left: `${targetPos.left}%` }}
              onClick={clickTarget}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clickTarget()}
            >
              <div className="itw-dot" style={targetColor ? { background: targetColor, boxShadow: "none" } : undefined} />
            </div>
            {decoys.map((d) => (
              <div
                key={d.id}
                className="itw-decoy-target"
                role="button"
                tabIndex={0}
                style={{ top: `${d.top}%`, left: `${d.left}%` }}
                onClick={clickDecoy}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clickDecoy()}
              >
                <div className="itw-dot" style={targetColor ? { background: "rgba(229,72,77,.9)", boxShadow: "0 0 0 10px rgba(229,72,77,.15), 0 0 30px rgba(229,72,77,.35)" } : undefined} />
              </div>
            ))}
          </>
        )}
        {cues.map((c) => (
          <div
            key={c.id}
            className="itw-sound-cue"
            style={{ top: `${c.top}%`, left: `${c.left}%` }}
          >
            <span className="itw-cue-icon" aria-hidden="true">{c.icon}</span>
            <span className="itw-cue-text">{c.text}</span>
          </div>
        ))}
      </Viewfinder>
      <div className="itw-sim-controls">
        {phase === "intro" && (
          <>
            <button className="itw-btn-primary" onClick={startTask}>
              Start observation task
            </button>
            <div className="itw-row" style={{ flex: "1 1 220px" }}>
              <label className="itw-mono" style={{ fontSize: 12, color: "var(--itw-muted)" }}>
                Unfiltered
              </label>
              <input type="range" min={0} max={100} value={filter} onChange={(e) => setFilter(+e.target.value)} />
              <label className="itw-mono" style={{ fontSize: 12, color: "var(--itw-muted)" }}>
                Filtered
              </label>
            </div>
          </>
        )}
        {phase === "task" && (
          <div className="itw-round-pips">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
              <span
                key={i}
                className={i < round - 1 ? "itw-pip-done" : i === round - 1 ? "itw-pip-current" : ""}
              />
            ))}
          </div>
        )}
        <div className="itw-readout">{readout}</div>
      </div>
      {rating && (
        <RatingCard
          title="What that round was like"
          lines={[
            `Cleared ${TOTAL_ROUNDS} rounds in ${rating.time}s, with ${rating.misses} decoy click(s) and ${rating.timeouts} round(s) where time ran out before you found it.`,
            rating.misses > 0 || rating.timeouts > 0
              ? "Every decoy or timeout above is what a nervous system taking in more than it can filter has to sort through constantly — and still gets wrong sometimes, even when trying hard."
              : "A clean run, even as the noise climbed toward full overload and the clock got tighter — run it again and see if that holds.",
          ]}
          onRetry={retry}
          retryLabel="Run it again"
        />
      )}
    </div>
  );
}

function AutismModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="autism"
      eyebrow="Autism"
      title="The room doesn't turn down."
      dek="For many autistic kids, sensory input doesn't fade into the background automatically — the hum of lights, a chair scraping, three conversations at once can all arrive at full volume, all at the same time."
      sections={[
        { id: "autism-try", label: "Try it" },
        { id: "autism-data", label: "The data" },
        { id: "autism-help", label: "How to help" },
      ]}
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block" id="autism-try">
        <div className="itw-block-label">Try it — Observation Task</div>
        <AutismSim />
      </section>
      <section className="itw-block" id="autism-data">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          facts={[
            { num: "~1 in 100", label: "children under age 10 in India may have autism, per a large community-based sample", src: "INCLEN Trust study, PLOS Medicine" },
            { num: "0.4–1.8%", label: "regional spread found across India, from urban North Goa to rural Palwal, Haryana", src: "INCLEN Trust study, PLOS Medicine" },
            { num: "1 in 8", label: "children in the same sample had at least one neurodevelopmental condition of any kind", src: "INCLEN Trust study, PLOS Medicine" },
          ]}
          note="Sensory overload isn't a behavior problem — it's a nervous system taking in more raw input than it can sort through in real time. India's 2011 census recorded autism at a fraction of this rate — researchers call that a large undercount, driven by limited screening access and stigma, not a genuinely lower rate of autism."
          onComplete={() => scrollToId("autism-help")}
        />
      </section>
      <section className="itw-block itw-help-block" id="autism-help">
        <div className="itw-help-head">
          <div className="itw-help-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="itw-help-eyebrow">What actually helps</div>
            <h3 className="itw-help-title">How you can help</h3>
          </div>
        </div>
        <StrategyTabs
          home={[
            "Build in a low-stimulation space the child can retreat to before overload turns into a meltdown, not after.",
            "Give transitions a warning — “five more minutes” — instead of a sudden switch between activities.",
            "Ask what specifically feels like “too much” (a sound, a fabric, a smell) instead of guessing.",
            "Treat stimming (rocking, hand-flapping, fidgeting) as a regulation tool, not something to stop.",
          ]}
          classroom={[
            "Offer noise-reducing headphones or a seat away from the door/window as a default option, not a special favor.",
            "Post the day's schedule visually — unpredictability is often harder than the activities themselves.",
            "Give instructions one step at a time, and check for understanding rather than assuming eye contact means engagement.",
            "Build in movement or quiet breaks between high-stimulation activities like assemblies or fire drills.",
          ]}
        />
      </section>
    </ModuleShell>
  );
}

/* ================= ADHD: focus task simulator ================= */

const DISTRACT_MSGS = [
  "New message!", "Reminder: due tomorrow", "Someone's watching you",
  "That song is stuck in your head", "Only 2 minutes left!", "Did you hear that?",
  "Don't forget your bag", "Ooh, shiny thing over here", "Click me!",
  "Just one more round...", "There's a bird outside the window", "Someone passed you a note",
  "Wait, what were you doing again?", "Is that your name being called?",
];

function AdhdSim() {
  const { soundOn } = useContext(SettingsContext);
  const [numbers, setNumbers] = useState([]); // {num, top, left, status: 'pending'|'done'|'miss'}
  const [nextNum, setNextNum] = useState(1);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(false);
  const [distractOn, setDistractOn] = useState(true);
  const [distractions, setDistractions] = useState([]); // {id, text, top, left, opacity, urgent}
  const [frozen, setFrozen] = useState(false);
  const [readout, setReadout] = useState("Ready when you are.");
  const [rating, setRating] = useState(null);

  const startTimeRef = useRef(0);
  const distractTimeoutRef = useRef(null);
  const timeoutsRef = useRef([]);
  const distractIdRef = useRef(0);
  const numbersRef = useRef([]);
  const nextNumRef = useRef(1);

  useEffect(() => {
    numbersRef.current = numbers;
  }, [numbers]);
  useEffect(() => {
    nextNumRef.current = nextNum;
  }, [nextNum]);

  const clearAllTimers = useCallback(() => {
    if (distractTimeoutRef.current) clearTimeout(distractTimeoutRef.current);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  useEffect(() => {
    audio.setDroneGain("adhd", soundOn && running ? 0.025 : 0.0001);
  }, [soundOn, running]);

  useEffect(() => {
    if (!soundOn) {
      audio.stopDrone("adhd");
      return;
    }
    audio.startDrone("adhd", { freqs: [220, 330], type: "triangle" });
    return () => audio.stopDrone("adhd");
  }, [soundOn]);

  // Positions distractions well away from every pending/visible number so they
  // never physically sit on top of a target — they compete for attention, they
  // don't literally block the click underneath.
  const findDistractionSpot = () => {
    const avoid = numbersRef.current.map((n) => ({ top: n.top, left: n.left }));
    let top, left, ok, tries = 0;
    do {
      top = 4 + Math.random() * 84;
      left = 4 + Math.random() * 66;
      ok = true;
      for (const p of avoid) {
        if (Math.abs(p.top - top) < 12 && Math.abs(p.left - left) < 12) ok = false;
      }
      tries++;
    } while (!ok && tries < 20);
    return { top, left };
  };

  const scheduleNextDistraction = useCallback(() => {
    // Spawns get a little faster as the run progresses, but gently —
    // this should feel like real pressure, not a punishing gauntlet.
    const progress = Math.min(1, (nextNumRef.current - 1) / 9);
    const delay = 1650 - progress * 550 + Math.random() * 400;
    distractTimeoutRef.current = setTimeout(() => {
      spawnDistraction();
      scheduleNextDistraction();
    }, delay);
  }, []);

  const spawnDistraction = useCallback(() => {
    const id = distractIdRef.current++;
    const pos = findDistractionSpot();
    const text = DISTRACT_MSGS[Math.floor(Math.random() * DISTRACT_MSGS.length)];
    const d = { id, text, ...pos, opacity: 0, urgent: false };
    setDistractions((prev) => [...prev, d]);
    if (soundOn) {
      audio.noiseBurst({ duration: 0.12, gain: 0.05, filterFreq: 2400 });
      speakText(text, { rate: 1.15, pitch: 1.05, volume: 0.5 });
    }
    const t1 = setTimeout(() => {
      setDistractions((prev) => prev.map((x) => (x.id === id ? { ...x, opacity: 1 } : x)));
    }, 20);
    // Plenty of grace before it turns urgent, and more still before it
    // actually costs you — dismissing should feel doable, not frantic.
    const t2 = setTimeout(() => {
      setDistractions((prev) => prev.map((x) => (x.id === id ? { ...x, urgent: true } : x)));
      if (soundOn) audio.tone({ freq: 660, type: "square", duration: 0.1, gain: 0.06 });
    }, 2400);
    const t3 = setTimeout(() => {
      setDistractions((prev) => {
        const still = prev.find((x) => x.id === id);
        if (!still) return prev; // already dismissed
        if (soundOn) audio.sweep({ from: 400, to: 100, duration: 0.3, type: "sawtooth", gain: 0.1 });
        setMisses((m) => m + 1);
        setFrozen(true);
        const tf = setTimeout(() => setFrozen(false), 350);
        timeoutsRef.current.push(tf);
        return prev.filter((x) => x.id !== id);
      });
    }, 3800);
    timeoutsRef.current.push(t1, t2, t3);
  }, [soundOn]);

  const dismissDistraction = (id) => {
    if (!running) return;
    setDistractions((prev) => prev.filter((x) => x.id !== id));
    if (soundOn) audio.tone({ freq: 420, type: "sine", duration: 0.09, gain: 0.06 });
  };

  // Attention drift: if the current target sits too long, it relocates —
  // the same task, but attention has to keep re-finding it.
  useEffect(() => {
    if (!running) return;
    const target = nextNum;
    const wander = setInterval(() => {
      setNumbers((prev) => {
        const idx = prev.findIndex((n) => n.num === target && n.status === "pending");
        if (idx === -1) return prev;
        let top, left, ok;
        do {
          top = 8 + Math.random() * 76;
          left = 4 + Math.random() * 84;
          ok = true;
          for (const p of prev) {
            if (p.num === target) continue;
            if (Math.abs(p.top - top) < 13 && Math.abs(p.left - left) < 13) ok = false;
          }
        } while (!ok);
        const copy = [...prev];
        copy[idx] = { ...copy[idx], top, left, restless: true };
        return copy;
      });
      if (soundOn) audio.tone({ freq: 200, type: "triangle", duration: 0.08, gain: 0.04 });
      const clearT = setTimeout(() => {
        setNumbers((prev) => prev.map((n) => (n.num === target ? { ...n, restless: false } : n)));
      }, 500);
      timeoutsRef.current.push(clearT);
    }, 1800);
    return () => clearInterval(wander);
  }, [nextNum, running, soundOn]);

  const startFocus = () => {
    clearAllTimers();
    setDistractions([]);
    setFrozen(false);
    setMisses(0);
    setNextNum(1);
    setRunning(true);
    setRating(null);
    setReadout("Go — click 1 first.");

    const positions = [];
    const nums = [];
    for (let i = 1; i <= 10; i++) {
      let top, left, ok;
      do {
        top = 8 + Math.random() * 76;
        left = 4 + Math.random() * 84;
        ok = true;
        for (const p of positions) {
          if (Math.abs(p.top - top) < 13 && Math.abs(p.left - left) < 13) ok = false;
        }
      } while (!ok);
      positions.push({ top, left });
      nums.push({ num: i, top, left, status: "pending" });
    }
    setNumbers(nums);
    numbersRef.current = nums;
    startTimeRef.current = performance.now();

    if (distractOn) {
      scheduleNextDistraction();
    }
  };

  const clickNum = (num) => {
    if (!running || frozen) return;
    if (num !== nextNum) {
      setMisses((m) => m + 1);
      if (soundOn) audio.sweep({ from: 300, to: 120, duration: 0.18, type: "square", gain: 0.09 });
      setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "miss" } : n)));
      const t = setTimeout(() => {
        setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "pending" } : n)));
      }, 300);
      timeoutsRef.current.push(t);
      return;
    }
    if (soundOn) audio.tone({ freq: 420 + num * 30, type: "sine", duration: 0.12, gain: 0.11 });
    setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "done" } : n)));
    const next = nextNum + 1;
    setNextNum(next);
    if (next > 10) {
      clearAllTimers();
      setDistractions([]);
      setRunning(false);
      const time = (performance.now() - startTimeRef.current) / 1000;
      setReadout(`Done in ${time.toFixed(1)}s, with ${misses} misclick(s)/unhandled interruption(s).`);
      const penalty = misses * 8 + Math.max(0, time - 9) * 4;
      const score = Math.round(Math.max(0, Math.min(100, 100 - penalty)));
      setRating({ score, time: time.toFixed(1), misses, distractOn });
    }
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Click 1 through 10 in order, fast — the numbers won't wait, and neither will the interruptions.
      </div>
      <HowTo
        steps={[
          "Click 1 → 10 in order",
          "Dismiss pop-ups with ×",
          "Interruptions speed up over time",
        ]}
      />
      <Viewfinder hud={{ left: running ? `TARGET ${nextNum}/10` : "READY", right: `MISS ${misses}` }}>
        <div className={`itw-focus-field${frozen ? " itw-frozen" : ""}`}>
          {numbers.map((n) => (
            <button
              key={n.num}
              className={`itw-num-btn${n.status === "done" ? " itw-done" : ""}${
                n.status === "miss" ? " itw-miss" : ""
              }${n.restless ? " itw-restless" : ""}`}
              style={{ top: `${n.top}%`, left: `${n.left}%` }}
              onClick={() => clickNum(n.num)}
              disabled={frozen}
            >
              {n.num}
            </button>
          ))}
          {distractions.map((d) => (
            <div
              key={d.id}
              className={`itw-distraction${d.urgent ? " itw-urgent" : ""}`}
              style={{ top: `${d.top}%`, left: `${d.left}%`, opacity: d.opacity }}
            >
              <span>{d.text}</span>
              <button
                type="button"
                className="itw-distraction-x"
                onClick={() => dismissDistraction(d.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
          {frozen && <div className="itw-frozen-banner">Lost focus for a second — that interruption won.</div>}
        </div>
      </Viewfinder>
      <div className="itw-sim-controls">
        <button className="itw-btn-primary" onClick={startFocus} disabled={running}>
          Start round
        </button>
        <label className="itw-row" style={{ fontSize: 13, color: "var(--itw-muted)" }}>
          <input
            type="checkbox"
            checked={distractOn}
            onChange={(e) => setDistractOn(e.target.checked)}
            style={{ accentColor: "var(--itw-adhd)" }}
          />
          Simulate interruptions
        </label>
        <div className="itw-readout">{readout}</div>
      </div>
      {rating && (
        <RatingCard
          title="What just happened to your focus"
          lines={[
            `Finished in ${rating.time}s with ${rating.misses} misclick(s)/unhandled interruption(s), interruptions ${
              rating.distractOn ? "on" : "off"
            }.`,
            rating.distractOn
              ? "Run it again with interruptions off — most people finish faster and cleaner. That gap is roughly what constant, unfiltered pulls on attention cost, on every task, all day."
              : "Now try it again with interruptions on, and compare. The task never changed — only how much of your attention it was allowed to keep. Every interruption you had to dismiss was a beat of focus spent on something that wasn't the task.",
          ]}
          onRetry={startFocus}
          retryLabel="Run it again"
        />
      )}
    </div>
  );
}

function AdhdModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="adhd"
      eyebrow="ADHD"
      title="Attention isn't a switch."
      dek="It's not that kids with ADHD can't focus — it's that their attention responds to whatever is most stimulating in the moment, and staying locked onto one quiet task takes active, exhausting effort."
      sections={[
        { id: "adhd-try", label: "Try it" },
        { id: "adhd-data", label: "The data" },
        { id: "adhd-help", label: "How to help" },
      ]}
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block" id="adhd-try">
        <div className="itw-block-label">Try it — Focus Task</div>
        <AdhdSim />
      </section>
      <section className="itw-block" id="adhd-data">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          facts={[
            { num: "~7.1%", label: "pooled prevalence of ADHD among Indian children & adolescents, across 19 studies", src: "Indian systematic review & meta-analysis" },
            { num: "9.4% vs 5.2%", label: "prevalence among boys versus girls in the same pooled Indian data", src: "Indian systematic review & meta-analysis" },
            { num: "2–3", label: "students in a class of 30 are statistically likely to have ADHD, by the pooled Indian estimate", src: "Extrapolated from meta-analysis data" },
          ]}
          note="ADHD is a difference in how the brain regulates attention and impulse — not a lack of willpower. Individual Indian studies range widely, from about 2% in some community samples up to nearly 29% in others, reflecting differences in screening tools, region, and setting rather than a single settled national rate."
          onComplete={() => scrollToId("adhd-help")}
        />
      </section>
      <section className="itw-block itw-help-block" id="adhd-help">
        <div className="itw-help-head">
          <div className="itw-help-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="itw-help-eyebrow">What actually helps</div>
            <h3 className="itw-help-title">How you can help</h3>
          </div>
        </div>
        <StrategyTabs
          home={[
            "Break tasks into small, visible steps instead of one open-ended instruction like “clean your room.”",
            "Reduce visible clutter in the workspace where homework happens — fewer competing objects, fewer competing thoughts.",
            "Build in movement breaks between tasks rather than expecting long stretches of stillness.",
            "Praise the process (“you stuck with that”) more than just the outcome — motivation runs on frequent, immediate feedback.",
          ]}
          classroom={[
            "Seat near the front, away from the door, window, and high-traffic areas — not as punishment, as scaffolding.",
            "Chunk assignments with visible checkpoints instead of one long due date.",
            "Allow fidget tools or standing/movement options — they often support focus rather than undermine it.",
            "Give a heads-up before transitions; abrupt switches are where attention is most likely to derail.",
          ]}
        />
      </section>
    </ModuleShell>
  );
}

/* ================= DYSLEXIA: reading simulator ================= */

const READING_TEXT =
  "Maya packed her backpack the night before the field trip. She checked twice for her water bottle, her permission slip, and the drawing she made for her grandmother. The bus was loud and smelled like rubber, but she found a window seat and watched the fields turn from green to gold as the wind picked up outside.";

const COMPREHENSION_QUESTIONS = [
  {
    q: "What did Maya pack the night before, besides her water bottle?",
    options: ["Her permission slip and a drawing for her grandmother", "A book and headphones", "Her homework and a snack"],
    correct: 0,
  },
  {
    q: "Where did Maya sit on the bus?",
    options: ["Near the driver", "In a window seat", "At the very back"],
    correct: 1,
  },
  {
    q: "What did Maya notice happening outside as the bus rode along?",
    options: ["The fields turned from green to gold", "It started to rain", "The bus stopped at a farm"],
    correct: 0,
  },
];

const SWAP_PAIRS = { b: "d", d: "b", p: "q", q: "p" };

function ComprehensionQuiz({ onSubmit }) {
  const [answers, setAnswers] = useState(Array(COMPREHENSION_QUESTIONS.length).fill(null));

  const pick = (qi, oi) => {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[qi] = oi;
      return copy;
    });
  };

  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="itw-quiz">
      <div className="itw-quiz-label">Quick check — what did you actually take in?</div>
      {COMPREHENSION_QUESTIONS.map((item, qi) => (
        <div className="itw-quiz-q" key={qi}>
          <p>{item.q}</p>
          <div className="itw-quiz-opts">
            {item.options.map((opt, oi) => (
              <button
                key={oi}
                type="button"
                className={`itw-quiz-opt${answers[qi] === oi ? " itw-active" : ""}`}
                onClick={() => pick(qi, oi)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        className="itw-btn-primary"
        disabled={!allAnswered}
        onClick={() => {
          const correct = answers.filter((a, i) => a === COMPREHENSION_QUESTIONS[i].correct).length;
          onSubmit(correct);
        }}
      >
        Check my answers
      </button>
    </div>
  );
}

function DyslexiaSim() {
  const { soundOn } = useContext(SettingsContext);
  const [mode, setMode] = useState("typical");
  const [chars, setChars] = useState(() => READING_TEXT.split(""));
  const [readout, setReadout] = useState("Timer will start once you pick a view.");
  const [awaitingQuiz, setAwaitingQuiz] = useState(false);
  const [rating, setRating] = useState(null);
  const timesRef = useRef({ typical: null, simulated: null });
  const readStartRef = useRef(performance.now());
  const intervalRef = useRef(null);
  const finishedModeRef = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    setRating(null);
    setAwaitingQuiz(false);
    if (mode === "simulated") {
      intervalRef.current = setInterval(() => {
        let swapped = false;
        setChars(
          READING_TEXT.split("").map((orig) => {
            const lower = orig.toLowerCase();
            if (SWAP_PAIRS[lower] && Math.random() < 0.35) {
              swapped = true;
              const s = SWAP_PAIRS[lower];
              return orig === lower ? s : s.toUpperCase();
            }
            return orig;
          })
        );
        if (swapped && soundOn) audio.noiseBurst({ duration: 0.05, gain: 0.03, filterFreq: 3200 });
      }, 700);
      setReadout("Simulated view — timer running…");
    } else {
      setChars(READING_TEXT.split(""));
      setReadout("Typical view — timer running…");
    }
    readStartRef.current = performance.now();
    return () => clearInterval(intervalRef.current);
  }, [mode, soundOn]);

  const finishReading = () => {
    const t = (performance.now() - readStartRef.current) / 1000;
    clearInterval(intervalRef.current);
    timesRef.current[mode] = t;
    finishedModeRef.current = { mode, t };
    if (soundOn) audio.tone({ freq: 480, type: "sine", duration: 0.2, gain: 0.1 });
    setReadout(
      `${t.toFixed(1)}s in ${mode} view. Now answer a few quick questions on what you just read.`
    );
    setAwaitingQuiz(true);
  };

  const submitQuiz = (correctCount) => {
    setAwaitingQuiz(false);
    const { mode, t } = finishedModeRef.current;
    const { typical, simulated } = timesRef.current;
    const comprehensionPct = Math.round((correctCount / COMPREHENSION_QUESTIONS.length) * 100);
    const lines = [
      `Finished the passage in ${t.toFixed(1)}s in ${mode} view, with ${correctCount} of ${COMPREHENSION_QUESTIONS.length} comprehension questions right.`,
    ];
    let score;
    if (typical != null && simulated != null) {
      const ratio = simulated / typical;
      const speedScore = Math.max(30, Math.min(100, 100 - (ratio - 1) * 25));
      score = Math.round(speedScore * 0.5 + comprehensionPct * 0.5);
      lines.push(
        `The simulated view took ${ratio.toFixed(1)}× as long as the typical one for you — a gap dyslexic readers live with on every page, not just this one passage.`
      );
      lines.push(
        comprehensionPct === 100
          ? "Full marks on comprehension, though — which is the real point: understanding was never the hard part, decoding speed was."
          : "Reading speed and understanding are different skills — a slow, careful reader can still land every question."
      );
    } else {
      score = Math.round(Math.max(40, Math.min(100, 100 - t * 2)) * 0.5 + comprehensionPct * 0.5);
      lines.push(`Try the other view now, so the speed comparison actually means something.`);
    }
    setRating({ score, lines });
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Read the passage, then compare how it feels in typical view versus simulated view.
      </div>
      <HowTo
        steps={[
          "Read the passage below",
          "Click “I've finished reading”",
          "Switch views and compare",
        ]}
      />
      <div className="itw-strat-tabs" style={{ padding: "16px 18px 0" }}>
        <button
          className={`itw-btn-ghost${mode === "typical" ? " itw-active" : ""}`}
          onClick={() => setMode("typical")}
          disabled={awaitingQuiz}
        >
          Typical view
        </button>
        <button
          className={`itw-btn-ghost${mode === "simulated" ? " itw-active" : ""}`}
          onClick={() => setMode("simulated")}
          disabled={awaitingQuiz}
        >
          Simulated view
        </button>
      </div>
      <Viewfinder
        hud={{ left: awaitingQuiz ? "PASSAGE HIDDEN" : mode === "simulated" ? "SIMULATED VIEW" : "TYPICAL VIEW", right: "" }}
        stageStyle={{ minHeight: "auto", background: "var(--itw-panel)" }}
      >
        {awaitingQuiz ? (
          <div className="itw-passage-hidden">
            <p>The passage is hidden now — answer from what you remember, the way a real reader has to.</p>
          </div>
        ) : (
          <div className={`itw-reading-passage${mode === "simulated" ? " itw-simulated" : ""}`}>
            {chars.map((ch, i) => (
              <span className="itw-ch" key={i} style={{ animationDelay: `${(i % 12) * 0.18}s` }}>
                {ch}
              </span>
            ))}
          </div>
        )}
      </Viewfinder>
      <div className="itw-sim-controls">
        <button className="itw-btn-primary" onClick={finishReading} disabled={awaitingQuiz}>
          I've finished reading
        </button>
        <div className="itw-readout">{readout}</div>
      </div>
      {awaitingQuiz && <ComprehensionQuiz onSubmit={submitQuiz} />}
      {rating && (
        <RatingCard
          title="What decoding that text was like"
          lines={rating.lines}
          onRetry={() => setRating(null)}
          retryLabel="Keep comparing"
        />
      )}
    </div>
  );
}

function DyslexiaModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="dyslexia"
      eyebrow="Dyslexia"
      title="Smart, and still stuck on the sentence."
      dek="Dyslexia isn't about seeing letters backwards — it's a difference in how the brain connects written symbols to sounds. Comprehension is usually fine. Decoding the words to get there is the hard part."
      sections={[
        { id: "dyslexia-try", label: "Try it" },
        { id: "dyslexia-data", label: "The data" },
        { id: "dyslexia-help", label: "How to help" },
      ]}
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block" id="dyslexia-try">
        <div className="itw-block-label">Try it — Reading Challenge</div>
        <DyslexiaSim />
      </section>
      <section className="itw-block" id="dyslexia-data">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          facts={[
            { num: "10–15%", label: "of Indian children are estimated to be dyslexic", src: "Dyslexia Association of India" },
            { num: "6.2%", label: "pooled prevalence of dyslexia specifically, from a meta-analysis of Indian studies", src: "Indian systematic review & meta-analysis, 2022" },
            { num: "~80%", label: "of specific learning disorders diagnosed in India are dyslexia, same as the global pattern", src: "Indian systematic review, 2023" },
          ]}
          note="A dyslexic child who reads slowly and understands nothing on a timed test may understand everything when given more time or the text read aloud. India's pooled estimate for all learning disabilities combined runs around 10.7% of school-age children — individual studies range from about 2% to over 30% depending on region and screening method."
          onComplete={() => scrollToId("dyslexia-help")}
        />
      </section>
      <section className="itw-block itw-help-block" id="dyslexia-help">
        <div className="itw-help-head">
          <div className="itw-help-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="itw-help-eyebrow">What actually helps</div>
            <h3 className="itw-help-title">How you can help</h3>
          </div>
        </div>
        <StrategyTabs
          home={[
            "Read aloud together well past the age other kids stop needing it — it protects a love of stories while decoding catches up.",
            "Use audiobooks and text-to-speech for content, so struggling to decode doesn't block access to ideas.",
            "Praise effort and strategy, not speed — a slow, correct reader is not behind in intelligence.",
            "Ask the school about a formal evaluation early; structured, phonics-based intervention works best the sooner it starts.",
          ]}
          classroom={[
            "Give extended time on reading-heavy tests — the accommodation targets decoding speed, not comprehension.",
            "Offer notes or slides in advance so class time can go to discussion instead of first-pass decoding.",
            "Never ask a dyslexic student to read aloud cold, in front of the class, without warning.",
            "Use structured literacy / explicit phonics instruction — it's the intervention with the strongest evidence behind it.",
          ]}
        />
      </section>
    </ModuleShell>
  );
}

/* ================= SPEECH: word-finding simulator ================= */

const PUSH_DECAY_PER_TICK = 3;
const PUSH_GAIN_PER_TAP = 13;
const PUSH_BASE = 40;

const CONVO_PROMPTS = [
  { npc: "Hey! Quick — tell me one thing that happened at school today.", time: 14, difficulty: 0 },
  { npc: "Nice. What's your favorite thing to do after school?", time: 11, difficulty: 1 },
  { npc: "Okay — if you could have any superpower, what would it be, and why?", time: 9, difficulty: 2 },
  { npc: "Last one, fast: what did you have for breakfast this morning?", time: 7, difficulty: 3 },
];

function SpeechSim() {
  const { soundOn } = useContext(SettingsContext);
  const [roundIdx, setRoundIdx] = useState(-1); // -1 = not started
  const [inputVal, setInputVal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [outputWords, setOutputWords] = useState([]);
  const [face, setFace] = useState("idle");
  const [pushWord, setPushWord] = useState(null);
  const [pushProgress, setPushProgress] = useState(0);
  const [pushRequired, setPushRequired] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [note, setNote] = useState("");
  const [results, setResults] = useState([]); // {success, timeUsed, taps}
  const [rating, setRating] = useState(null);
  const [tapBurst, setTapBurst] = useState(0);

  const genRef = useRef(0);
  const roundIdxRef = useRef(-1);
  const queueRef = useRef([]);
  const wordIdxRef = useRef(0);
  const roundStartRef = useRef(0);
  const tapsRoundRef = useRef(0);
  const progressRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const decayRef = useRef(null);
  const resultsRef = useRef([]);
  const timeoutsRef = useRef([]);

  const clearAll = () => {
    clearInterval(timerIntervalRef.current);
    clearInterval(decayRef.current);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      genRef.current++;
      clearAll();
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const recordResult = (r) => {
    resultsRef.current = [...resultsRef.current, r];
    setResults(resultsRef.current);
  };

  const finishAll = () => {
    const rs = resultsRef.current;
    const successCount = rs.filter((r) => r.success).length;
    const totalTaps = rs.reduce((a, r) => a + r.taps, 0);
    const successTimes = rs.filter((r) => r.success).map((r) => r.timeUsed);
    const avgTime = successTimes.length ? successTimes.reduce((a, b) => a + b, 0) / successTimes.length : 0;
    const base = (successCount / CONVO_PROMPTS.length) * 70;
    const efficiency = successCount ? Math.max(0, 30 - totalTaps * 1.1) : 0;
    const score = Math.round(Math.max(5, Math.min(100, base + efficiency)));
    setRoundIdx(CONVO_PROMPTS.length);
    setRating({
      score,
      lines: [
        `${successCount} of ${CONVO_PROMPTS.length} moment(s) answered in time, ${totalTaps} push(es) total${
          successCount ? `, averaging ${avgTime.toFixed(1)}s when you made it` : ""
        }.`,
        rs.some((r) => !r.success)
          ? "Every missed moment above was a question you knew the answer to — the conversation just didn't wait long enough for the words to arrive. That's the part a stopwatch on 'getting a word out' alone doesn't capture."
          : "You beat the clock on every question, even with words blocking along the way — most real conversations don't leave this much room to try again.",
      ],
    });
  };

  const advance = (idx) => {
    if (idx + 1 < CONVO_PROMPTS.length) beginRound(idx + 1);
    else finishAll();
  };

  const momentPassed = (idx, gen) => {
    if (gen !== genRef.current) return;
    clearInterval(decayRef.current);
    setPushWord(null);
    setFace("idle");
    setNote("The moment passed — time ran out before it all got out.");
    recordResult({ success: false, timeUsed: CONVO_PROMPTS[idx].time, taps: tapsRoundRef.current });
    const t = setTimeout(() => {
      if (gen === genRef.current) advance(idx);
    }, 1500);
    timeoutsRef.current.push(t);
  };

  const beginWord = (gen) => {
    if (gen !== genRef.current) return;
    const idx = roundIdxRef.current;
    if (wordIdxRef.current >= queueRef.current.length) {
      clearInterval(timerIntervalRef.current);
      setFace("done");
      setNote("Got it all out in time.");
      recordResult({
        success: true,
        timeUsed: (performance.now() - roundStartRef.current) / 1000,
        taps: tapsRoundRef.current,
      });
      const t = setTimeout(() => {
        if (gen === genRef.current) advance(idx);
      }, 1200);
      timeoutsRef.current.push(t);
      return;
    }
    const w = queueRef.current[wordIdxRef.current];
    if (w.blocked) {
      progressRef.current = 0;
      setPushProgress(0);
      setPushRequired(w.required);
      setPushWord(w.text);
      setFace("blocked");
      if (soundOn) audio.sweep({ from: 220, to: 260, duration: 0.25, type: "square", gain: 0.06 });
      clearInterval(decayRef.current);
      decayRef.current = setInterval(() => {
        if (gen !== genRef.current) return clearInterval(decayRef.current);
        progressRef.current = Math.max(0, progressRef.current - PUSH_DECAY_PER_TICK);
        setPushProgress(progressRef.current);
      }, 180);
    } else {
      setFace("talking");
      if (soundOn) {
        audio.tone({ freq: 340, type: "sine", duration: 0.08, gain: 0.06 });
        speakText(w.text, { rate: 1.1, volume: 0.85 });
      }
      setOutputWords((prev) => [...prev, { text: w.text, blocked: false }]);
      wordIdxRef.current++;
      const t = setTimeout(() => beginWord(gen), 170);
      timeoutsRef.current.push(t);
    }
  };

  const pushTap = () => {
    const gen = genRef.current;
    if (pushWord == null) return;
    tapsRoundRef.current++;
    setTapBurst((n) => n + 1);
    progressRef.current = Math.min(pushRequired, progressRef.current + PUSH_GAIN_PER_TAP);
    setPushProgress(progressRef.current);
    if (soundOn) audio.tone({ freq: 260 + Math.random() * 90, type: "square", duration: 0.04, gain: 0.05 });
    if (progressRef.current >= pushRequired) {
      clearInterval(decayRef.current);
      const w = queueRef.current[wordIdxRef.current];
      if (soundOn) {
        audio.tone({ freq: 540, type: "sine", duration: 0.14, gain: 0.1 });
        speakText(w.text, { rate: 0.9, volume: 0.85 });
      }
      setFace("talking");
      setOutputWords((prev) => [...prev, { text: w.text, blocked: true }]);
      setPushWord(null);
      wordIdxRef.current++;
      const t = setTimeout(() => beginWord(gen), 220);
      timeoutsRef.current.push(t);
    }
  };

  const submitAnswer = () => {
    const value = inputVal.trim();
    if (!value || submitted) return;
    setSubmitted(true);
    const gen = genRef.current;
    const diff = CONVO_PROMPTS[roundIdxRef.current].difficulty;
    const words = value.split(/\s+/);
    queueRef.current = words.map((w) => {
      const blockChance = (w.length > 4 ? 0.42 : 0.2) + diff * 0.07;
      const isBlocked = Math.random() < blockChance;
      return {
        text: w,
        blocked: isBlocked,
        required: isBlocked ? PUSH_BASE + w.length * 5 + diff * 10 : 0,
      };
    });
    wordIdxRef.current = 0;
    tapsRoundRef.current = 0;
    setOutputWords([]);
    beginWord(gen);
  };

  const beginRound = (idx) => {
    const gen = ++genRef.current;
    clearAll();
    roundIdxRef.current = idx;
    setRoundIdx(idx);
    setInputVal("");
    setSubmitted(false);
    setOutputWords([]);
    setPushWord(null);
    setFace("idle");
    setNote("");
    const total = CONVO_PROMPTS[idx].time;
    setTimeTotal(total);
    setTimeLeft(total);
    roundStartRef.current = performance.now();
    if (soundOn) speakText(CONVO_PROMPTS[idx].npc, { rate: 1, volume: 0.9 });
    timerIntervalRef.current = setInterval(() => {
      if (gen !== genRef.current) return clearInterval(timerIntervalRef.current);
      const elapsed = (performance.now() - roundStartRef.current) / 1000;
      const remaining = total - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(timerIntervalRef.current);
        momentPassed(idx, gen);
      } else {
        setTimeLeft(remaining);
      }
    }, 60);
  };

  const start = () => {
    resultsRef.current = [];
    setResults([]);
    setRating(null);
    beginRound(0);
  };

  const pushPct = pushRequired ? Math.round((pushProgress / pushRequired) * 100) : 0;
  const timerPct = timeTotal ? Math.max(0, Math.min(100, (timeLeft / timeTotal) * 100)) : 100;
  const active = roundIdx >= 0 && roundIdx < CONVO_PROMPTS.length;

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Answer {CONVO_PROMPTS.length} quick questions before your window to reply closes.
      </div>
      <HowTo
        steps={[
          "Type your answer",
          "Hit “Say it” to respond",
          "Tap “Push” if a word gets stuck",
        ]}
      />
      <Viewfinder
        hud={{ left: active ? `QUESTION ${roundIdx + 1}/${CONVO_PROMPTS.length}` : "READY", right: "" }}
        stageStyle={{ minHeight: "auto" }}
      >
        {active && (
          <div className="itw-round-timer">
            <div
              className="itw-round-timer-fill"
              style={{ width: `${timerPct}%`, background: timerPct < 25 ? "#e5484d" : "var(--itw-speech)" }}
            />
          </div>
        )}
        <div className="itw-speech-scene">
          {active ? (
            <div className={`itw-convo-bubble${timerPct < 30 ? " itw-convo-impatient" : ""}`}>
              {CONVO_PROMPTS[roundIdx].npc}
            </div>
          ) : roundIdx >= CONVO_PROMPTS.length ? (
            <div className="itw-convo-bubble">That's everyone — see how it went below.</div>
          ) : (
            <div className="itw-convo-bubble itw-convo-idle">A quick back-and-forth is about to start.</div>
          )}
          {active && (
            <div className={`itw-convo-partner${timerPct < 30 ? " itw-partner-waiting" : ""}`}>
              {timerPct < 15 ? "😬" : timerPct < 30 ? "🤨" : "🙂"}
              <span className="itw-partner-label">
                {timerPct < 15 ? "waiting..." : timerPct < 30 ? "still there?" : "listening"}
              </span>
            </div>
          )}
          <div className={`itw-speech-face${face === "blocked" ? " itw-straining" : ""}`}>
            {face === "blocked" ? "😣" : face === "talking" ? "🗣️" : face === "done" ? "🙂" : "😐"}
          </div>
          {pushWord != null && (
            <div className="itw-push-zone">
              <div className="itw-push-word">
                {pushWord.slice(0, Math.max(1, Math.round((pushPct / 100) * pushWord.length)))}
                <span className="itw-push-word-rest">
                  {pushWord.slice(Math.max(1, Math.round((pushPct / 100) * pushWord.length)))}
                </span>
              </div>
              <div className="itw-push-bar">
                <div className="itw-push-bar-fill" style={{ width: `${pushPct}%` }} />
              </div>
              <button
                key={tapBurst}
                type="button"
                className="itw-push-btn"
                onClick={pushTap}
                onTouchStart={(e) => {
                  e.preventDefault();
                  pushTap();
                }}
              >
                Push
              </button>
            </div>
          )}
        </div>
      </Viewfinder>
      <div className="itw-sim-controls" style={{ borderTop: "1px solid var(--itw-border)" }}>
        {roundIdx === -1 && (
          <button className="itw-btn-primary" onClick={start}>
            Start the conversation
          </button>
        )}
        {active && (
          <>
            <input
              type="text"
              className="itw-textin"
              placeholder="Type your answer..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              disabled={submitted}
              autoFocus
            />
            <button className="itw-btn-primary" onClick={submitAnswer} disabled={submitted}>
              Say it
            </button>
          </>
        )}
        {roundIdx >= CONVO_PROMPTS.length && (
          <button className="itw-btn-primary" onClick={start}>
            Try again
          </button>
        )}
      </div>
      <div style={{ padding: "0 18px 20px" }}>
        <div className="itw-speech-output">
          {outputWords.map((w, i) => (
            <span key={i} className={w.blocked ? "itw-blocked" : ""}>
              {w.text}{" "}
            </span>
          ))}
        </div>
        <div className="itw-readout" style={{ marginTop: 10 }}>
          {note}
        </div>
        {rating && (
          <RatingCard
            title="What finding those words was like"
            lines={rating.lines}
            onRetry={start}
            retryLabel="Try the conversation again"
          />
        )}
      </div>
    </div>
  );
}

function SpeechModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="speech"
      eyebrow="Speech & Language"
      title="The word is there. It's just not arriving yet."
      dek="For kids with speech sound disorders, stuttering, or word-finding difficulties, the thought is usually fully formed — the gap is between knowing what to say and getting it out cleanly."
      sections={[
        { id: "speech-try", label: "Try it" },
        { id: "speech-data", label: "The data" },
        { id: "speech-help", label: "How to help" },
      ]}
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block" id="speech-try">
        <div className="itw-block-label">Try it — Find the Words</div>
        <SpeechSim />
      </section>
      <section className="itw-block" id="speech-data">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          facts={[
            { num: "~1 in 11", label: "at-risk children were confirmed to have a speech or language disorder on full evaluation", src: "Indian rural communication-disorder screening study" },
            { num: "1.5%", label: "of children aged 4–16 showed stuttering in a Bangalore-area epidemiological study", src: "Srinath et al., Bangalore child & adolescent psychiatric disorder study" },
            { num: "10%", label: "of people with a communication disorder in India stutter, per a leading speech & hearing institute", src: "All India Institute of Speech and Hearing (AIISH)" },
          ]}
          note="A blocked word or a mispronounced sound is not a sign of not knowing the answer. India is linguistically dense — many children grow up multilingual, which researchers note can complicate early screening for a genuine speech or language disorder versus normal multilingual development."
          onComplete={() => scrollToId("speech-help")}
        />
      </section>
      <section className="itw-block itw-help-block" id="speech-help">
        <div className="itw-help-head">
          <div className="itw-help-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4a5 5 0 0 1 6.4 2 5 5 0 0 1 6.4-2C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="itw-help-eyebrow">What actually helps</div>
            <h3 className="itw-help-title">How you can help</h3>
          </div>
        </div>
        <StrategyTabs
          home={[
            "Let the child finish their own sentence — resist filling in the word for them, even when you're sure what it is.",
            "Slow down your own speech rate slightly; a calmer pace models ease rather than urgency.",
            "React to what they said, not how they said it — “tell me more” beats correcting the delivery.",
            "Keep eye contact relaxed and unhurried during a block instead of looking away or finishing for them.",
          ]}
          classroom={[
            "Never make a child with a stutter or speech disorder read aloud on the spot, unprepared, in front of peers.",
            "Give extra response time after asking a question before calling on someone else.",
            "Coordinate with the speech-language pathologist on classroom strategies, not just pull-out sessions.",
            "Normalize communication differences openly with the whole class so the child isn't the only one navigating stigma.",
          ]}
        />
      </section>
    </ModuleShell>
  );
}

/* ---------------- Root ---------------- */

export default function InTheirWorld() {
  const [view, setView] = useState("landing");
  const [soundOn, setSoundOn] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("itw-dark-mode");
    if (saved !== null) return saved === "1";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    window.localStorage.setItem("itw-dark-mode", darkMode ? "1" : "0");
    document.body.style.background = darkMode ? "#14180f" : "#f7f8f5";
    document.body.style.margin = "0";
  }, [darkMode]);

  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const goBack = () => setView("landing");
  const navigate = (key) => setView(key);

  const accentTable = darkMode ? ACCENT_HEX_DARK : ACCENT_HEX;
  const glow = `rgba(${accentTable[view] || accentTable.landing}, .16)`;
  const settings = useMemo(() => ({ soundOn }), [soundOn]);

  return (
    <SettingsContext.Provider value={settings}>
      <div className={`itw-root${darkMode ? " itw-dark" : ""}`}>
        <div className="itw-grain" aria-hidden="true" />
        <div className="itw-ambient" style={{ "--itw-glow": glow }} aria-hidden="true" />
        <div className="itw-app">
          <SettingsBar soundOn={soundOn} setSoundOn={setSoundOn} darkMode={darkMode} setDarkMode={setDarkMode} />
          {view === "landing" && <Landing onSelect={setView} />}
          {view === "autism" && <AutismModule key="autism" onBack={goBack} onNavigate={navigate} />}
          {view === "adhd" && <AdhdModule key="adhd" onBack={goBack} onNavigate={navigate} />}
          {view === "dyslexia" && <DyslexiaModule key="dyslexia" onBack={goBack} onNavigate={navigate} />}
          {view === "speech" && <SpeechModule key="speech" onBack={goBack} onNavigate={navigate} />}
        </div>
      </div>
    </SettingsContext.Provider>
  );
}
