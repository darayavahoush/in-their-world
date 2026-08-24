import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./InTheirWorld.css";

/* ============================================================
   In Their World
   A field guide for parents & teachers — four short interactive
   simulations (autism, ADHD, dyslexia, speech/language) plus
   real prevalence data and practical strategies.

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

/* ---------------- Landing ---------------- */

const MODULES = [
  {
    key: "autism",
    tag: "Module 01",
    name: "Autism",
    blurb: "Sensory processing, filtering, and why a “normal” room can feel like too much.",
    statBig: "1 in 31",
    statRest: "8-year-olds in the US (CDC, 2022 data)",
  },
  {
    key: "adhd",
    tag: "Module 02",
    name: "ADHD",
    blurb: "What it takes to hold attention on one task while everything else pulls at you.",
    statBig: "11.4%",
    statRest: "of US children, ever diagnosed (CDC, 2022)",
  },
  {
    key: "dyslexia",
    tag: "Module 03",
    name: "Dyslexia",
    blurb: "Decoding text when letters won't sit still and reading takes real effort, every line.",
    statBig: "15–20%",
    statRest: "show signs of dyslexia (Intl. Dyslexia Assoc.)",
  },
  {
    key: "speech",
    tag: "Module 04",
    name: "Speech & Language",
    blurb: "Knowing exactly what you want to say — and having the words arrive late, or not at all.",
    statBig: "1 in 12",
    statRest: "kids, voice/speech/language disorder (NIDCD)",
  },
];

function Landing({ onSelect }) {
  return (
    <section className="itw-view">
      <div className="itw-masthead">
        <div className="itw-eyebrow itw-rise itw-rise-1">A field guide for parents &amp; teachers</div>
        <h1 className="itw-title itw-rise itw-rise-2">
          In their <em>world</em>,<br />for a few minutes.
        </h1>
        <p className="itw-lede itw-rise itw-rise-3">
          Four short, interactive experiences that simulate what focus, reading, sensory
          input, and speaking out loud can feel like for kids with autism, ADHD, dyslexia,
          or a speech difference — paired with the real data and practical steps that follow.
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
              <b>{m.statBig}</b> <span style={{ color: "var(--itw-muted)" }}>{m.statRest}</span>
            </div>
            <div className="itw-enter">Step in →</div>
          </button>
        ))}
      </div>

      <div className="itw-foot-note">
        Built as an awareness &amp; training tool. Statistics are drawn from CDC, NIDCD,
        ASHA, and the International Dyslexia Association, and are approximate — prevalence
        estimates shift as diagnostic criteria and access to evaluation change.
      </div>
    </section>
  );
}

/* ---------------- Shared module shell ---------------- */

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

function FactsGrid({ facts, note }) {
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

/* ================= AUTISM: sensory overload simulator ================= */

const NOISE_PHRASES = [
  "PAY ATTENTION", "chair scraping", "someone's laughing", "the light is humming",
  "bell in 3...2...", "don't forget your homework", "LOOK AT ME WHEN I TALK",
  "whose backpack is this", "the fan is loud", "hallway noise", "someone dropped a tray",
  "fluorescent flicker", "five more minutes", "line up now", "where's your pencil", "recess is over",
];
const NOISE_COLORS = ["#4fb3a6", "#e8a23d", "#e37b6e", "#a48ce0", "#ffffff"];

function AutismSim() {
  const [filter, setFilter] = useState(10); // 0 = raw, 100 = filtered
  const intensity = (100 - filter) / 100;

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
      Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        size: 20 + Math.random() * 60,
        top: Math.random() * 90,
        left: Math.random() * 90,
        color: ["#4fb3a6", "#e8a23d", "#e37b6e", "#a48ce0"][i % 4],
        baseOpacity: 0.12 + Math.random() * 0.18,
        duration: 3 + Math.random() * 4,
      })),
    []
  );

  const readout =
    filter < 25
      ? "This is closer to a packed classroom during free time — bright lights, side conversations, a chair scraping."
      : filter < 55
      ? "Partial filtering — like stepping into a slightly quieter hallway, but the noise hasn't gone away."
      : filter < 85
      ? "This is closer to what noise-reducing headphones and dimmer lighting can offer."
      : "This is what a genuinely quiet, low-stimulation space feels like — the task hasn't changed, only the ability to focus on it.";

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Find the red dot in the scene below. Then drag the slider and watch what changes —
        not the task, but everything <em>around</em> it.
      </div>
      <div className="itw-sim-stage">
        <div className="itw-sensory-target">
          <div className="itw-dot" />
          <p>find me</p>
        </div>
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
      </div>
      <div className="itw-sim-controls">
        <div className="itw-row">
          <label className="itw-mono" style={{ fontSize: 12, color: "var(--itw-muted)" }}>
            Unfiltered
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={filter}
            onChange={(e) => setFilter(+e.target.value)}
          />
          <label className="itw-mono" style={{ fontSize: 12, color: "var(--itw-muted)" }}>
            Filtered
          </label>
        </div>
        <div className="itw-readout">{readout}</div>
      </div>
    </div>
  );
}

function AutismModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="autism"
      eyebrow="Module 01 — Autism"
      title="The room doesn't turn down."
      dek="For many autistic kids, sensory input doesn't fade into the background automatically — the hum of lights, a chair scraping, three conversations at once can all arrive at full volume, all at the same time."
      onBack={onBack}
      onNavigate={onNavigate}
    >
      <section className="itw-block">
        <div className="itw-block-label">Try it — Sensory Filter</div>
        <AutismSim />
      </section>
      <section className="itw-block">
        <div className="itw-block-label">The data</div>
        <FactsGrid
          facts={[
            { num: "1 in 31", label: "8-year-olds in the US identified with autism spectrum disorder", src: "CDC ADDM Network, 2022 data (released 2025)" },
            { num: "~90%", label: "of autistic people report sensory sensitivities — sound, light, texture, or touch", src: "Commonly cited across sensory-processing research" },
            { num: "4:1", label: "boys diagnosed for every girl — though many researchers believe girls are underdiagnosed, not less affected", src: "CDC ADDM Network" },
          ]}
          note="Sensory overload isn't a behavior problem — it's a nervous system taking in more raw input than it can sort through in real time. What looks like “not listening” or “melting down” is often a filtering system working overtime."
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
  "📌 Don't forget your bag", "✨ Shiny thing over here",
];

function AdhdSim() {
  const [numbers, setNumbers] = useState([]); // {num, top, left, status: 'pending'|'done'|'miss'}
  const [nextNum, setNextNum] = useState(1);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(false);
  const [distractOn, setDistractOn] = useState(true);
  const [distractions, setDistractions] = useState([]); // {id, text, top, left, opacity}
  const [readout, setReadout] = useState("Ready when you are.");

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

  const spawnDistraction = useCallback(() => {
    const id = distractIdRef.current++;
    const d = {
      id,
      text: DISTRACT_MSGS[Math.floor(Math.random() * DISTRACT_MSGS.length)],
      top: Math.random() * 80,
      left: Math.random() * 65,
      opacity: 0,
    };
    setDistractions((prev) => [...prev, d]);
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
    }, 1300);
    timeoutsRef.current.push(t1, t2);
  }, []);

  const startFocus = () => {
    clearAllTimers();
    setDistractions([]);
    setMisses(0);
    setNextNum(1);
    setRunning(true);
    setReadout("Go — click 1 first.");

    const positions = [];
    const nums = [];
    for (let i = 1; i <= 8; i++) {
      let top, left, ok;
      do {
        top = 10 + Math.random() * 70;
        left = 5 + Math.random() * 80;
        ok = true;
        for (const p of positions) {
          if (Math.abs(p.top - top) < 14 && Math.abs(p.left - left) < 14) ok = false;
        }
      } while (!ok);
      positions.push({ top, left });
      nums.push({ num: i, top, left, status: "pending" });
    }
    setNumbers(nums);
    startTimeRef.current = performance.now();

    if (distractOn) {
      distractIntervalRef.current = setInterval(spawnDistraction, 900);
    }
  };

  const clickNum = (num) => {
    if (!running) return;
    if (num !== nextNum) {
      setMisses((m) => m + 1);
      setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "miss" } : n)));
      const t = setTimeout(() => {
        setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "pending" } : n)));
      }, 300);
      timeoutsRef.current.push(t);
      return;
    }
    setNumbers((prev) => prev.map((n) => (n.num === num ? { ...n, status: "done" } : n)));
    const next = nextNum + 1;
    setNextNum(next);
    if (next > 8) {
      clearAllTimers();
      setDistractions([]);
      setRunning(false);
      const time = ((performance.now() - startTimeRef.current) / 1000).toFixed(1);
      setReadout(
        `Done in ${time}s, with ${misses} misclick(s). Try again with distractions off to compare.`
      );
    }
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Click the numbers 1 through 8, in order, as fast as you can. Toggle distractions on
        or off and compare your time.
      </div>
      <div className="itw-sim-stage">
        <div className="itw-focus-field">
          {numbers.map((n) => (
            <button
              key={n.num}
              className={`itw-num-btn${n.status === "done" ? " itw-done" : ""}${
                n.status === "miss" ? " itw-miss" : ""
              }`}
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
            >
              {d.text}
            </div>
          ))}
        </div>
      </div>
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
    </div>
  );
}

function AdhdModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="adhd"
      eyebrow="Module 02 — ADHD"
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
          facts={[
            { num: "11.4%", label: "of US children aged 3–17 have ever been diagnosed with ADHD — about 1 in 9", src: "CDC / 2022 National Survey of Children's Health" },
            { num: "~78%", label: "of kids with ADHD have at least one co-occurring condition, most often anxiety", src: "CDC, 2022" },
            { num: "3–4", label: "students in a class of 30 are statistically likely to have an ADHD diagnosis", src: "Extrapolated from CDC prevalence data" },
          ]}
          note="ADHD is a difference in how the brain regulates attention and impulse — not a lack of willpower. A distraction-heavy environment doesn't cause ADHD, but it makes the same task measurably harder to finish."
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
  const [mode, setMode] = useState("typical");
  const [chars, setChars] = useState(() => READING_TEXT.split(""));
  const [readout, setReadout] = useState("Timer will start once you pick a view.");
  const readStartRef = useRef(performance.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (mode === "simulated") {
      intervalRef.current = setInterval(() => {
        setChars(
          READING_TEXT.split("").map((orig) => {
            const lower = orig.toLowerCase();
            if (SWAP_PAIRS[lower] && Math.random() < 0.35) {
              const swapped = SWAP_PAIRS[lower];
              return orig === lower ? swapped : swapped.toUpperCase();
            }
            return orig;
          })
        );
      }, 700);
      setReadout("Simulated view — timer running…");
    } else {
      setChars(READING_TEXT.split(""));
      setReadout("Typical view — timer running…");
    }
    readStartRef.current = performance.now();
    return () => clearInterval(intervalRef.current);
  }, [mode]);

  const finishReading = () => {
    const t = ((performance.now() - readStartRef.current) / 1000).toFixed(1);
    clearInterval(intervalRef.current);
    setReadout(
      `${t}s in ${mode} view. Many dyslexic readers take noticeably longer in real reading, every single time, on every page — not because they didn't understand, but because decoding takes real, repeated effort.`
    );
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Read the passage below, then click “I've finished reading.” Try the typical view
        first, then switch to simulated and compare.
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
      <div className="itw-sim-stage" style={{ minHeight: "auto", background: "var(--itw-panel)" }}>
        <div className={`itw-reading-passage${mode === "simulated" ? " itw-simulated" : ""}`}>
          {chars.map((ch, i) => (
            <span className="itw-ch" key={i} style={{ animationDelay: `${(i % 12) * 0.18}s` }}>
              {ch}
            </span>
          ))}
        </div>
      </div>
      <div className="itw-sim-controls">
        <button className="itw-btn-primary" onClick={finishReading}>
          I've finished reading
        </button>
        <div className="itw-readout">{readout}</div>
      </div>
    </div>
  );
}

function DyslexiaModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="dyslexia"
      eyebrow="Module 03 — Dyslexia"
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
          facts={[
            { num: "15–20%", label: "of the population shows some signs of dyslexia", src: "International Dyslexia Association" },
            { num: "~80%", label: "of all diagnosed learning disabilities are dyslexia — it's the most common one by far", src: "Intl. Dyslexia Association" },
            { num: "40–60%", label: "chance a child has dyslexia if a parent does — it runs strongly in families", src: "Yale Center for Dyslexia & Creativity" },
          ]}
          note="A dyslexic child who reads slowly and understands nothing on a timed test may understand everything when given more time or the text read aloud. Speed of decoding and strength of comprehension are two different skills."
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
  const [inputVal, setInputVal] = useState("");
  const [outputWords, setOutputWords] = useState([]); // {text, blocked}
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const speakIt = async () => {
    const value = inputVal.trim();
    if (!value) {
      setReadout("Type something first — what do you want to say?");
      return;
    }
    setRunning(true);
    setOutputWords([]);
    cancelledRef.current = false;

    const words = value.split(/\s+/);
    const start = performance.now();

    for (const w of words) {
      if (cancelledRef.current) return;
      const blockChance = w.length > 4 ? 0.45 : 0.2;
      if (Math.random() < blockChance) {
        const syll = w.slice(0, Math.min(2, w.length));
        const reps = 2 + Math.floor(Math.random() * 3);
        setOutputWords((prev) => [...prev, { text: syll + "-", blocked: true }]);
        for (let i = 0; i < reps; i++) {
          if (cancelledRef.current) return;
          const stutter = syll + "-".repeat((i % 2) + 1);
          setOutputWords((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { text: stutter, blocked: true };
            return copy;
          });
          await sleep(220);
        }
        await sleep(300);
        if (cancelledRef.current) return;
        setOutputWords((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { text: w, blocked: false };
          return copy;
        });
      } else {
        setOutputWords((prev) => [...prev, { text: w, blocked: false }]);
        await sleep(120);
      }
    }

    const total = ((performance.now() - start) / 1000).toFixed(1);
    setReadout(
      `That took ${total}s to say out loud. You knew the whole sentence the second you typed it — that gap between knowing and saying is what a speech or word-finding difference can feel like, every single sentence, all day.`
    );
    setRunning(false);
  };

  return (
    <div className="itw-sim">
      <div className="itw-sim-instructions">
        Type a short sentence describing the scene below, then click “Say it.” Watch what
        happens on the way out.
      </div>
      <div className="itw-sim-stage" style={{ minHeight: "auto" }}>
        <div className="itw-speech-scene">🎂🎈🎁</div>
      </div>
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
      </div>
    </div>
  );
}

function SpeechModule({ onBack, onNavigate }) {
  return (
    <ModuleShell
      accent="speech"
      eyebrow="Module 04 — Speech & Language"
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
          facts={[
            { num: "~1 in 12", label: "US children ages 3–17 have had a voice, speech, or language disorder", src: "NIDCD / NIH" },
            { num: "7%", label: "of children have a developmental language disorder — about 1 in 14", src: "NIDCD" },
            { num: "10.8%", label: "prevalence among kids aged 3–6, the highest of any age band — many outgrow it with support", src: "NIDCD" },
          ]}
          note="A blocked word or a mispronounced sound is not a sign of not knowing the answer. Rushing a child to “just spit it out” almost always makes the block worse, not better."
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

  const goBack = () => setView("landing");
  const navigate = (key) => setView(key);

  const glow = `rgba(${ACCENT_HEX[view] || ACCENT_HEX.landing}, .16)`;

  return (
    <div className="itw-root">
      <div className="itw-grain" aria-hidden="true" />
      <div className="itw-ambient" style={{ "--itw-glow": glow }} aria-hidden="true" />
      <div className="itw-app">
        {view === "landing" && <Landing onSelect={setView} />}
        {view === "autism" && <AutismModule key="autism" onBack={goBack} onNavigate={navigate} />}
        {view === "adhd" && <AdhdModule key="adhd" onBack={goBack} onNavigate={navigate} />}
        {view === "dyslexia" && <DyslexiaModule key="dyslexia" onBack={goBack} onNavigate={navigate} />}
        {view === "speech" && <SpeechModule key="speech" onBack={goBack} onNavigate={navigate} />}
      </div>
    </div>
  );
}
