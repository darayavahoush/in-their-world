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

const ACCENT_HEX = {
  landing: "79,179,166",
  autism: "79,179,166",
  adhd: "232,162,61",
  dyslexia: "164,140,224",
  speech: "227,123,110",
};

/* ---------------- Settings context (sound + stats region) ---------------- */

const SettingsContext = createContext({ soundOn: true, country: "us" });

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
    tag: "Case File 01",
    name: "Autism",
    blurb: "Sensory processing, filtering, and why a “normal” room can feel like too much.",
    statBig: "1 in 31",
    statRest: "8-year-olds in the US (CDC, 2022 data)",
    statBigIN: "~1 in 100",
    statRestIN: "children under 10 in India (INCLEN Trust, PLOS Medicine)",
  },
  {
    key: "adhd",
    tag: "Case File 02",
    name: "ADHD",
    blurb: "What it takes to hold attention on one task while everything else pulls at you.",
    statBig: "11.4%",
    statRest: "of US children, ever diagnosed (CDC, 2022)",
    statBigIN: "~7.1%",
    statRestIN: "pooled prevalence, Indian children & adolescents (19-study meta-analysis)",
  },
  {
    key: "dyslexia",
    tag: "Case File 03",
    name: "Dyslexia",
    blurb: "Decoding text when letters won't sit still and reading takes real effort, every line.",
    statBig: "15–20%",
    statRest: "show signs of dyslexia (Intl. Dyslexia Assoc.)",
    statBigIN: "10–15%",
    statRestIN: "of Indian children, estimated dyslexic (Dyslexia Association of India)",
  },
  {
    key: "speech",
    tag: "Case File 04",
    name: "Speech & Language",
    blurb: "Knowing exactly what you want to say — and having the words arrive late, or not at all.",
    statBig: "1 in 12",
    statRest: "kids, voice/speech/language disorder (NIDCD)",
    statBigIN: "~1 in 11",
    statRestIN: "at-risk children found to have one on evaluation (Indian rural screening study)",
  },
];

function Landing({ onSelect }) {
  const { country } = useContext(SettingsContext);
  return (
    <section className="itw-view">
      <div className="itw-masthead">
        <div className="itw-eyebrow itw-rise itw-rise-1">Field observation log — for parents &amp; teachers</div>
        <h1 className="itw-title itw-rise itw-rise-2">
          In their <em>world</em>,<br />for a few minutes.
        </h1>
        <p className="itw-lede itw-rise itw-rise-3">
          Four short, interactive experiences that simulate what focus, reading, sensory
          input, and speaking out loud can feel like for kids with autism, ADHD, dyslexia,
          or a speech difference — each one a small task you attempt and get rated on,
          paired with real data and practical steps that follow.
        </p>
        <div className="itw-disclaimer itw-rise itw-rise-4">
          <strong>Before you start:</strong> these simulations are approximations, built to
          build empathy — not diagnoses, and not any one child's exact experience. No two
          autistic, ADHD, dyslexic, or speech-affected kids experience the world identically.
          Use this as a starting point for curiosity, not a stereotype.
        </div>
      </div>

      <div className="itw-grid-eyebrow itw-rise itw-rise-5">Four experiences</div>
      <div className="itw-module-grid itw-rise itw-rise-5">
        {MODULES.map((m) => (
          <button key={m.key} className="itw-mcard" data-m={m.key} onClick={() => onSelect(m.key)}>
            <div className="itw-tag">{m.tag}</div>
            <h3>{m.name}</h3>
            <p>{m.blurb}</p>
            <div className="itw-stat">
              <b>{country === "in" ? m.statBigIN : m.statBig}</b>{" "}
              <span style={{ color: "var(--itw-muted)" }}>
                {country === "in" ? m.statRestIN : m.statRest}
              </span>
            </div>
            <div className="itw-enter">Open the file →</div>
          </button>
        ))}
      </div>

      <div className="itw-foot-note">
        Built as an awareness &amp; training tool. Global/US statistics are drawn from CDC,
        NIDCD, ASHA, and the International Dyslexia Association; India statistics are drawn
        from peer-reviewed Indian epidemiological studies and meta-analyses. All figures are
        approximate — prevalence estimates shift as diagnostic criteria, screening access,
        and study methodology change, and vary further by region within each country.
      </div>
    </section>
  );
}

/* ---------------- Shared module shell ---------------- */

function SettingsBar({ soundOn, setSoundOn, country, setCountry }) {
  return (
    <div className="itw-settings-bar">
      <button
        type="button"
        className={`itw-toggle-btn${soundOn ? " itw-active" : ""}`}
        aria-pressed={soundOn}
        onClick={() => setSoundOn((v) => !v)}
      >
        {soundOn ? "🔊 Sound on" : "🔇 Sound off"}
      </button>
      <div className="itw-country-toggle" role="tablist" aria-label="Statistics region">
        <button
          type="button"
          role="tab"
          aria-selected={country === "us"}
          className={country === "us" ? "itw-active" : ""}
          onClick={() => setCountry("us")}
        >
          🌍 US / Global
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={country === "in"}
          className={country === "in" ? "itw-active" : ""}
          onClick={() => setCountry("in")}
        >
          🇮🇳 India
        </button>
      </div>
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

function FactsGrid({ factsUS, factsIN, note, noteIN }) {
  const { country } = useContext(SettingsContext);
  const facts = country === "in" && factsIN ? factsIN : factsUS;
  const shownNote = country === "in" && noteIN ? noteIN : note;
  return (
    <>
      <div className="itw-facts-grid">
        {facts.map((f, i) => (
          <div className="itw-fact-card" key={i}>
            <div className="itw-num">{f.num}</div>
            <div className="itw-lbl">{f.label}</div>
            <div className="itw-src">{f.src}</div>
          </div>
        ))}
      </div>
      {shownNote && <p className="itw-fact-note">{shownNote}</p>}
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

function ModuleShell({ accent, eyebrow, title, dek, onBack, onNavigate, children }) {
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
            {(hud && hud.left) || "OBSERVING"}
          </span>
          <span>{(hud && hud.right) || ""}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Rating card (shared by every task) ---------------- */

function RatingCard({ title, score, maxScore = 100, lines, retryLabel = "Try again", onRetry }) {
  const pct = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
  const stars = Math.max(1, Math.min(5, Math.round(pct / 20)));
  useEffect(() => {
    audio.tone({ freq: 523, type: "sine", duration: 0.16, gain: 0.1 });
    audio.tone({ freq: 659, type: "sine", duration: 0.2, gain: 0.09, delay: 0.09 });
  }, []);
  return (
    <div className="itw-rating-card" role="status">
      <div className="itw-rating-top">
        <div>
          <div className="itw-rating-title">{title}</div>
          <div className="itw-rating-stars" aria-hidden="true">
            {"★".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </div>
        </div>
        <div className="itw-rating-score">
          {Math.round(score)}
          <span>/{maxScore}</span>
        </div>
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

/* ================= AUTISM: sensory overload simulator ================= */

const NOISE_PHRASES = [
  "PAY ATTENTION", "chair scraping", "someone's laughing", "the light is humming",
  "bell in 3...2...", "don't forget your homework", "LOOK AT ME WHEN I TALK",
  "whose backpack is this", "the fan is loud", "hallway noise", "someone dropped a tray",
  "fluorescent flicker", "five more minutes", "line up now", "where's your pencil", "recess is over",
  "STOP TALKING", "someone's phone buzzing", "the projector hum", "footsteps behind you",
  "chalk squeaking", "two kids arguing", "door slamming", "your name, called twice",
];
const NOISE_COLORS = ["#4fb3a6", "#e8a23d", "#e37b6e", "#a48ce0", "#ffffff"];

const TOTAL_ROUNDS = 5;

function AutismSim() {
  const { soundOn } = useContext(SettingsContext);
  const [phase, setPhase] = useState("intro"); // intro | task | done
  const [filter, setFilter] = useState(10); // exploration-only, before the graded task starts
  const [round, setRound] = useState(0);
  const [targetPos, setTargetPos] = useState({ top: 50, left: 50 });
  const [decoys, setDecoys] = useState([]);
  const [misses, setMisses] = useState(0);
  const [rating, setRating] = useState(null);

  const roundStartRef = useRef(0);
  const timeAccRef = useRef(0);
  const missesRef = useRef(0);
  const decoyIdRef = useRef(0);

  const practiceIntensity = (100 - filter) / 100;
  const taskIntensity = Math.min(1, 0.3 + (round - 1) * 0.175);
  const intensity = phase === "task" ? taskIntensity : practiceIntensity;

  const noiseItems = useMemo(
    () =>
      NOISE_PHRASES.map((text, i) => ({
        id: i,
        text,
        top: Math.random() * 90,
        left: Math.random() * 80,
        color: NOISE_COLORS[i % NOISE_COLORS.length],
        baseOpacity: 0.35 + Math.random() * 0.5,
        duration: 2 + Math.random() * 3,
      })),
    []
  );
  const buzzShapes = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        size: 26 + Math.random() * 100,
        top: Math.random() * 92,
        left: Math.random() * 92,
        color: ["#4fb3a6", "#e8a23d", "#e37b6e", "#a48ce0"][i % 4],
        baseOpacity: 0.14 + Math.random() * 0.22,
        duration: 2.5 + Math.random() * 4,
      })),
    []
  );

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
      ? round >= 4
        ? "Full overload — this is what an unfiltered classroom feels like on its worst day. Find the real target anyway."
        : "Noise climbs every round, on its own. There's no slider now — this is the part that doesn't turn down on demand."
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
        if (Math.abs(p.top - top) < 17 && Math.abs(p.left - left) < 17) ok = false;
      }
    } while (!ok);
    return { top, left };
  };

  const setupRound = (roundNum) => {
    const t = randPos([]);
    const decoyCount = roundNum >= 3 ? 2 : 1;
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
  };

  const startTask = () => {
    timeAccRef.current = 0;
    missesRef.current = 0;
    setMisses(0);
    setRating(null);
    setPhase("task");
    setRound(1);
    setupRound(1);
  };

  const clickTarget = () => {
    if (phase !== "task") return;
    const elapsed = (performance.now() - roundStartRef.current) / 1000;
    timeAccRef.current += elapsed;
    if (soundOn) audio.tone({ freq: 700, type: "sine", duration: 0.16, gain: 0.13 });
    if (round >= TOTAL_ROUNDS) {
      const totalTime = timeAccRef.current;
      const avgTime = totalTime / TOTAL_ROUNDS;
      const speedScore = Math.max(0, 100 - avgTime * 20);
      const missPenalty = missesRef.current * 12;
      const score = Math.round(Math.max(0, Math.min(100, speedScore - missPenalty + 8)));
      setPhase("done");
      setRating({ score, time: totalTime.toFixed(1), misses: missesRef.current });
    } else {
      const next = round + 1;
      setRound(next);
      setupRound(next);
    }
  };

  const clickDecoy = () => {
    if (phase !== "task") return;
    missesRef.current += 1;
    setMisses(missesRef.current);
    if (soundOn) audio.sweep({ from: 500, to: 150, duration: 0.2, type: "sawtooth", gain: 0.1 });
  };

  const retry = () => {
    setPhase("intro");
    setRound(0);
    setRating(null);
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        <strong>Task:</strong> five rounds. Each round, find and click the <em>real</em> target,
        not the decoy — fast. Sensory noise gets worse every round, on its own, whether you're
        ready or not.
      </div>
      <Viewfinder
        hud={{
          left: phase === "task" ? `ROUND ${round}/${TOTAL_ROUNDS}` : "STANDBY",
          right: `${Math.round(intensity * 100)}% NOISE`,
        }}
      >
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
              <div className="itw-dot" />
              <p>find me</p>
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
                <div className="itw-dot" />
              </div>
            ))}
          </>
        )}
        {noiseItems.map((n) => (
          <div
            key={n.id}
            className="itw-noise-item"
            style={{
              top: `${n.top}%`,
              left: `${n.left}%`,
              color: n.color,
              opacity: (n.baseOpacity * intensity).toFixed(2),
              animation: `itw-floaty ${n.duration}s ease-in-out infinite`,
            }}
          >
            {n.text}
          </div>
        ))}
        {buzzShapes.map((b) => (
          <div
            key={b.id}
            className="itw-buzz-shape"
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              background: b.color,
              opacity: (b.baseOpacity * intensity).toFixed(2),
              animation: `itw-floaty ${b.duration}s ease-in-out infinite`,
            }}
          />
        ))}
        <div className="itw-flicker-overlay" style={{ opacity: (intensity * 0.15).toFixed(2) }} />
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
          title="Your focus score"
          score={rating.score}
          lines={[
            `Cleared all ${TOTAL_ROUNDS} rounds in ${rating.time}s total, with ${rating.misses} decoy click(s).`,
            rating.misses > 0
              ? "Every decoy you clicked was a false alarm — that's what a nervous system taking in more than it can filter has to sort through constantly, and still gets wrong sometimes."
              : "No false alarms, even as the noise climbed toward full overload — run it again and see if that holds.",
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
      eyebrow="Case File 01 — Autism"
      title="The room doesn't turn down."
      dek="For many autistic kids, sensory input doesn't fade into the background automatically — the hum of lights, a chair scraping, three conversations at once can all arrive at full volume, all at the same time."
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block">
        <div className="itw-block-label">Try it — Observation Task</div>
        <AutismSim />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          factsUS={[
            { num: "1 in 31", label: "8-year-olds in the US identified with autism spectrum disorder", src: "CDC ADDM Network, 2022 data (released 2025)" },
            { num: "~90%", label: "of autistic people report sensory sensitivities — sound, light, texture, or touch", src: "Commonly cited across sensory-processing research" },
            { num: "4:1", label: "boys diagnosed for every girl — though many researchers believe girls are underdiagnosed, not less affected", src: "CDC ADDM Network" },
          ]}
          factsIN={[
            { num: "~1 in 100", label: "children under age 10 in India may have autism, per a large community-based sample", src: "INCLEN Trust study, PLOS Medicine" },
            { num: "0.4–1.8%", label: "regional spread found across India, from urban North Goa to rural Palwal, Haryana", src: "INCLEN Trust study, PLOS Medicine" },
            { num: "1 in 8", label: "children in the same sample had at least one neurodevelopmental condition of any kind", src: "INCLEN Trust study, PLOS Medicine" },
          ]}
          note="Sensory overload isn't a behavior problem — it's a nervous system taking in more raw input than it can sort through in real time. What looks like “not listening” or “melting down” is often a filtering system working overtime."
          noteIN="India's 2011 census recorded autism at a fraction of this rate — researchers call that a large undercount, driven by limited screening access and stigma that keeps families from seeking evaluation, not by a genuinely lower rate of autism."
        />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">What this means for you</div>
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
  "📱 New message!", "🔔 Reminder: due tomorrow", "👀 Someone's watching you",
  "🎵 Song stuck in your head", "⏰ Only 2 minutes left!", "💬 Did you hear that?",
  "📌 Don't forget your bag", "✨ Shiny thing over here", "👉 Click me!",
  "🎮 Just one round...", "🐦 Bird outside the window", "😂 Someone passed a note",
];

function AdhdSim() {
  const { soundOn } = useContext(SettingsContext);
  const [numbers, setNumbers] = useState([]); // {num, top, left, status: 'pending'|'done'|'miss'}
  const [nextNum, setNextNum] = useState(1);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(false);
  const [distractOn, setDistractOn] = useState(true);
  const [distractions, setDistractions] = useState([]); // {id, text, top, left, opacity}
  const [readout, setReadout] = useState("Ready when you are.");
  const [rating, setRating] = useState(null);

  const startTimeRef = useRef(0);
  const distractIntervalRef = useRef(null);
  const timeoutsRef = useRef([]);
  const distractIdRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    if (distractIntervalRef.current) clearInterval(distractIntervalRef.current);
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

  const spawnDistraction = useCallback(() => {
    const id = distractIdRef.current++;
    const d = {
      id,
      text: DISTRACT_MSGS[Math.floor(Math.random() * DISTRACT_MSGS.length)],
      top: Math.random() * 82,
      left: Math.random() * 62,
      opacity: 0,
    };
    setDistractions((prev) => [...prev, d]);
    if (soundOn) audio.noiseBurst({ duration: 0.12, gain: 0.05, filterFreq: 2400 });
    // fade in
    const t1 = setTimeout(() => {
      setDistractions((prev) => prev.map((x) => (x.id === id ? { ...x, opacity: 1 } : x)));
    }, 20);
    // fade out then remove
    const t2 = setTimeout(() => {
      setDistractions((prev) => prev.map((x) => (x.id === id ? { ...x, opacity: 0 } : x)));
      const t3 = setTimeout(() => {
        setDistractions((prev) => prev.filter((x) => x.id !== id));
      }, 300);
      timeoutsRef.current.push(t3);
    }, 1400);
    timeoutsRef.current.push(t1, t2);
  }, [soundOn]);

  const clickDistraction = (id) => {
    if (!running) return;
    setDistractions((prev) => prev.filter((x) => x.id !== id));
    setMisses((m) => m + 1);
    if (soundOn) audio.sweep({ from: 500, to: 140, duration: 0.22, type: "sawtooth", gain: 0.11 });
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
    }, 1400);
    return () => clearInterval(wander);
  }, [nextNum, running, soundOn]);

  const startFocus = () => {
    clearAllTimers();
    setDistractions([]);
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
    startTimeRef.current = performance.now();

    if (distractOn) {
      distractIntervalRef.current = setInterval(spawnDistraction, 650);
    }
  };

  const clickNum = (num) => {
    if (!running) return;
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
      setReadout(`Done in ${time.toFixed(1)}s, with ${misses} misclick(s)/trap(s).`);
      const penalty = misses * 8 + Math.max(0, time - 9) * 4;
      const score = Math.round(Math.max(0, Math.min(100, 100 - penalty)));
      setRating({ score, time: time.toFixed(1), misses, distractOn });
    }
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        <strong>Task:</strong> click the numbers 1 through 10, in order, as fast as you can.
        Dawdle on one and it'll wander off — you'll have to re-find it. The floating bubbles
        are traps, not the task: clicking one costs you. Toggle distractions on or off and
        compare your time.
      </div>
      <Viewfinder hud={{ left: running ? `TARGET ${nextNum}/10` : "READY", right: `MISS ${misses}` }}>
        <div className="itw-focus-field">
          {numbers.map((n) => (
            <button
              key={n.num}
              className={`itw-num-btn${n.status === "done" ? " itw-done" : ""}${
                n.status === "miss" ? " itw-miss" : ""
              }${n.restless ? " itw-restless" : ""}`}
              style={{ top: `${n.top}%`, left: `${n.left}%` }}
              onClick={() => clickNum(n.num)}
            >
              {n.num}
            </button>
          ))}
          {distractions.map((d) => (
            <div
              key={d.id}
              className="itw-distraction"
              style={{ top: `${d.top}%`, left: `${d.left}%`, opacity: d.opacity }}
              onClick={() => clickDistraction(d.id)}
            >
              {d.text}
            </div>
          ))}
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
          Simulate distractions
        </label>
        <div className="itw-readout">{readout}</div>
      </div>
      {rating && (
        <RatingCard
          title="Your task-completion score"
          score={rating.score}
          lines={[
            `Finished in ${rating.time}s with ${rating.misses} misclick(s)/trap(s), distractions ${
              rating.distractOn ? "on" : "off"
            }.`,
            rating.distractOn
              ? "Run it again with distractions off — most people finish faster and cleaner. That gap is roughly what constant, unfiltered pulls on attention cost, on every task, all day."
              : "Now try it again with distractions on, and compare. The task never changed — only how much of your attention it was allowed to keep. Every wandering number is a beat of attention you had to spend just re-finding something you'd already located.",
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
      eyebrow="Case File 02 — ADHD"
      title="Attention isn't a switch."
      dek="It's not that kids with ADHD can't focus — it's that their attention responds to whatever is most stimulating in the moment, and staying locked onto one quiet task takes active, exhausting effort."
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block">
        <div className="itw-block-label">Try it — Focus Task</div>
        <AdhdSim />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          factsUS={[
            { num: "11.4%", label: "of US children aged 3–17 have ever been diagnosed with ADHD — about 1 in 9", src: "CDC / 2022 National Survey of Children's Health" },
            { num: "~78%", label: "of kids with ADHD have at least one co-occurring condition, most often anxiety", src: "CDC, 2022" },
            { num: "3–4", label: "students in a class of 30 are statistically likely to have an ADHD diagnosis", src: "Extrapolated from CDC prevalence data" },
          ]}
          factsIN={[
            { num: "~7.1%", label: "pooled prevalence of ADHD among Indian children & adolescents, across 19 studies", src: "Indian systematic review & meta-analysis" },
            { num: "9.4% vs 5.2%", label: "prevalence among boys versus girls in the same pooled Indian data", src: "Indian systematic review & meta-analysis" },
            { num: "2–3", label: "students in a class of 30 are statistically likely to have ADHD, by the pooled Indian estimate", src: "Extrapolated from meta-analysis data" },
          ]}
          note="ADHD is a difference in how the brain regulates attention and impulse — not a lack of willpower. A distraction-heavy environment doesn't cause ADHD, but it makes the same task measurably harder to finish."
          noteIN="Individual Indian studies range widely — from about 2% in some community samples up to nearly 29% in others — reflecting differences in screening tools, region, and setting rather than a single settled national rate."
        />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">What this means for you</div>
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

const SWAP_PAIRS = { b: "d", d: "b", p: "q", q: "p" };

function DyslexiaSim() {
  const { soundOn } = useContext(SettingsContext);
  const [mode, setMode] = useState("typical");
  const [chars, setChars] = useState(() => READING_TEXT.split(""));
  const [readout, setReadout] = useState("Timer will start once you pick a view.");
  const [rating, setRating] = useState(null);
  const timesRef = useRef({ typical: null, simulated: null });
  const readStartRef = useRef(performance.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    setRating(null);
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
    if (soundOn) audio.tone({ freq: 480, type: "sine", duration: 0.2, gain: 0.1 });
    setReadout(
      `${t.toFixed(1)}s in ${mode} view. Many dyslexic readers take noticeably longer in real reading, every single time, on every page — not because they didn't understand, but because decoding takes real, repeated effort.`
    );
    const { typical, simulated } = timesRef.current;
    const lines = [`Finished the passage in ${t.toFixed(1)}s in ${mode} view.`];
    let score;
    if (typical != null && simulated != null) {
      const ratio = simulated / typical;
      score = Math.round(Math.max(30, Math.min(100, 100 - (ratio - 1) * 25)));
      lines.push(
        `The simulated view took ${ratio.toFixed(1)}× as long as the typical one for you — a gap dyslexic readers live with on every page, not just this one passage.`
      );
      lines.push(
        "This isn't a comprehension score — reading speed and understanding are different skills, and a slow, careful reader can understand everything just as well."
      );
    } else {
      score = Math.round(Math.max(40, Math.min(100, 100 - t * 2)));
      lines.push(`Try the other view now, so the comparison actually means something.`);
    }
    setRating({ score, lines });
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        <strong>Task:</strong> read the passage below, then click “I've finished reading.” Try
        the typical view first, then switch to simulated and compare.
      </div>
      <div className="itw-strat-tabs" style={{ padding: "16px 18px 0" }}>
        <button
          className={`itw-btn-ghost${mode === "typical" ? " itw-active" : ""}`}
          onClick={() => setMode("typical")}
        >
          Typical view
        </button>
        <button
          className={`itw-btn-ghost${mode === "simulated" ? " itw-active" : ""}`}
          onClick={() => setMode("simulated")}
        >
          Simulated view
        </button>
      </div>
      <Viewfinder
        hud={{ left: mode === "simulated" ? "SIMULATED VIEW" : "TYPICAL VIEW", right: "" }}
        stageStyle={{ minHeight: "auto", background: "var(--itw-panel)" }}
      >
        <div className={`itw-reading-passage${mode === "simulated" ? " itw-simulated" : ""}`}>
          {chars.map((ch, i) => (
            <span className="itw-ch" key={i} style={{ animationDelay: `${(i % 12) * 0.18}s` }}>
              {ch}
            </span>
          ))}
        </div>
      </Viewfinder>
      <div className="itw-sim-controls">
        <button className="itw-btn-primary" onClick={finishReading}>
          I've finished reading
        </button>
        <div className="itw-readout">{readout}</div>
      </div>
      {rating && (
        <RatingCard
          title="Your reading-pace score"
          score={rating.score}
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
      eyebrow="Case File 03 — Dyslexia"
      title="Smart, and still stuck on the sentence."
      dek="Dyslexia isn't about seeing letters backwards — it's a difference in how the brain connects written symbols to sounds. Comprehension is usually fine. Decoding the words to get there is the hard part."
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block">
        <div className="itw-block-label">Try it — Reading Challenge</div>
        <DyslexiaSim />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          factsUS={[
            { num: "15–20%", label: "of the population shows some signs of dyslexia", src: "International Dyslexia Association" },
            { num: "~80%", label: "of all diagnosed learning disabilities are dyslexia — it's the most common one by far", src: "Intl. Dyslexia Association" },
            { num: "40–60%", label: "chance a child has dyslexia if a parent does — it runs strongly in families", src: "Yale Center for Dyslexia & Creativity" },
          ]}
          factsIN={[
            { num: "10–15%", label: "of Indian children are estimated to be dyslexic", src: "Dyslexia Association of India" },
            { num: "6.2%", label: "pooled prevalence of dyslexia specifically, from a meta-analysis of Indian studies", src: "Indian systematic review & meta-analysis, 2022" },
            { num: "~80%", label: "of specific learning disorders diagnosed in India are dyslexia, same as the global pattern", src: "Indian systematic review, 2023" },
          ]}
          note="A dyslexic child who reads slowly and understands nothing on a timed test may understand everything when given more time or the text read aloud. Speed of decoding and strength of comprehension are two different skills."
          noteIN="India's pooled estimate for all learning disabilities combined (reading, writing, and math difficulties together) runs around 10.7% of school-age children — individual Indian studies range from about 2% to over 30% depending on region and screening method."
        />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">What this means for you</div>
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

function SpeechSim() {
  const { soundOn } = useContext(SettingsContext);
  const [inputVal, setInputVal] = useState("");
  const [outputWords, setOutputWords] = useState([]); // {text, blocked}
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState("");
  const [rating, setRating] = useState(null);
  const [face, setFace] = useState("idle"); // idle | talking | blocked | done
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const speakIt = async () => {
    const value = inputVal.trim();
    if (!value) {
      setReadout("Type something first — what do you want to say?");
      return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setRunning(true);
    setRating(null);
    setOutputWords([]);
    setFace("idle");
    cancelledRef.current = false;

    const words = value.split(/\s+/);
    const start = performance.now();
    let blockedCount = 0;

    for (const w of words) {
      if (cancelledRef.current) return;
      const blockChance = w.length > 4 ? 0.45 : 0.2;
      if (Math.random() < blockChance) {
        blockedCount++;
        setFace("blocked");
        const syll = w.slice(0, Math.min(2, w.length));
        const reps = 2 + Math.floor(Math.random() * 3);
        setOutputWords((prev) => [...prev, { text: syll + "-", blocked: true }]);
        for (let i = 0; i < reps; i++) {
          if (cancelledRef.current) return;
          const stutter = syll + "-".repeat((i % 2) + 1);
          if (soundOn) {
            audio.sweep({ from: 220, to: 260, duration: 0.12, type: "square", gain: 0.07 });
            speakText(syll, { rate: 1.5, pitch: 1.15, volume: 0.55 });
          }
          setOutputWords((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { text: stutter, blocked: true };
            return copy;
          });
          await sleep(220);
        }
        await sleep(300);
        if (cancelledRef.current) return;
        setFace("talking");
        if (soundOn) {
          audio.tone({ freq: 540, type: "sine", duration: 0.14, gain: 0.1 });
          speakText(w, { rate: 0.9, volume: 0.85 });
        }
        setOutputWords((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { text: w, blocked: false };
          return copy;
        });
      } else {
        setFace("talking");
        if (soundOn) {
          audio.tone({ freq: 340, type: "sine", duration: 0.08, gain: 0.06 });
          speakText(w, { rate: 1.05, volume: 0.85 });
        }
        setOutputWords((prev) => [...prev, { text: w, blocked: false }]);
        await sleep(120);
      }
    }

    const total = (performance.now() - start) / 1000;
    setFace("done");
    setReadout(
      `That took ${total.toFixed(1)}s to say out loud. You knew the whole sentence the second you typed it — that gap between knowing and saying is what a speech or word-finding difference can feel like, every single sentence, all day.`
    );
    const idealTime = words.length * 0.35;
    const score = Math.round(Math.max(20, Math.min(100, 100 - (total - idealTime) * 6)));
    setRating({
      score,
      lines: [
        `${blockedCount} of ${words.length} word(s) blocked before coming out, taking ${total.toFixed(1)}s total.`,
        blockedCount > 0
          ? "Every block above was a word you already knew — the delay was entirely in getting it out, not in thinking of it."
          : "This run had no blocks — try a longer or wordier sentence and see how the odds change.",
      ],
    });
    setRunning(false);
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        <strong>Task:</strong> type a short sentence describing the scene below, then click
        “Say it.” It'll actually be spoken aloud (turn sound on) — watch, and listen to, what
        happens on the way out.
      </div>
      <Viewfinder
        hud={{ left: running ? "SPEAKING…" : "READY", right: "" }}
        stageStyle={{ minHeight: "auto" }}
      >
        <div className="itw-speech-scene">
          <div className="itw-scene-emoji">🎂🎈🎁</div>
          <div className={`itw-speech-face${face === "blocked" ? " itw-straining" : ""}`}>
            {face === "blocked" ? "😣" : face === "talking" ? "🗣️" : face === "done" ? "🙂" : "😐"}
          </div>
        </div>
      </Viewfinder>
      <div className="itw-sim-controls" style={{ borderTop: "1px solid var(--itw-border)" }}>
        <input
          type="text"
          className="itw-textin"
          placeholder="It's my little brother's birthday party..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && speakIt()}
        />
        <button className="itw-btn-primary" onClick={speakIt} disabled={running}>
          Say it
        </button>
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
          {readout}
        </div>
        {rating && (
          <RatingCard
            title="Your delivery score"
            score={rating.score}
            lines={rating.lines}
            onRetry={() => setRating(null)}
            retryLabel="Try another sentence"
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
      eyebrow="Case File 04 — Speech & Language"
      title="The word is there. It's just not arriving yet."
      dek="For kids with speech sound disorders, stuttering, or word-finding difficulties, the thought is usually fully formed — the gap is between knowing what to say and getting it out cleanly."
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block">
        <div className="itw-block-label">Try it — Find the Words</div>
        <SpeechSim />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          factsUS={[
            { num: "~1 in 12", label: "US children ages 3–17 have had a voice, speech, or language disorder", src: "NIDCD / NIH" },
            { num: "7%", label: "of children have a developmental language disorder — about 1 in 14", src: "NIDCD" },
            { num: "10.8%", label: "prevalence among kids aged 3–6, the highest of any age band — many outgrow it with support", src: "NIDCD" },
          ]}
          factsIN={[
            { num: "~1 in 11", label: "at-risk children were confirmed to have a speech or language disorder on full evaluation", src: "Indian rural communication-disorder screening study" },
            { num: "1.5%", label: "of children aged 4–16 showed stuttering in a Bangalore-area epidemiological study", src: "Srinath et al., Bangalore child & adolescent psychiatric disorder study" },
            { num: "10%", label: "of people with a communication disorder in India stutter, per a leading speech & hearing institute", src: "All India Institute of Speech and Hearing (AIISH)" },
          ]}
          note="A blocked word or a mispronounced sound is not a sign of not knowing the answer. Rushing a child to “just spit it out” almost always makes the block worse, not better."
          noteIN="India is linguistically dense — many children grow up multilingual, which researchers note can complicate early screening for a genuine speech or language disorder versus normal multilingual development."
        />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">What this means for you</div>
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
  const [country, setCountry] = useState("us");

  const goBack = () => setView("landing");
  const navigate = (key) => setView(key);

  const glow = `rgba(${ACCENT_HEX[view] || ACCENT_HEX.landing}, .16)`;
  const settings = useMemo(() => ({ soundOn, country }), [soundOn, country]);

  return (
    <SettingsContext.Provider value={settings}>
      <div className="itw-root">
        <div className="itw-grain" aria-hidden="true" />
        <div className="itw-ambient" style={{ "--itw-glow": glow }} aria-hidden="true" />
        <div className="itw-app">
          <SettingsBar
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            country={country}
            setCountry={setCountry}
          />
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
