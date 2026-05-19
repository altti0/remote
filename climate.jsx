// Main climate controller UI for the 1280×480 horizontal device.
// Left ~(1 - presence): tactile manual controls. Right (presence): AI atmosphere.

const { useState, useEffect, useRef, useMemo } = React;

// ── primitives ────────────────────────────────────────────────────────────

function Dial({ value, label, suffix, onChange, min = 16, max = 30, step = 0.5 }) {
  // A tall vertical slider: drag up = increase
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);

  const handle = (clientY) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    const raw = min + pct * (max - min);
    onChange(Math.round(raw / step) * step);
  };

  const onDown = (e) => {
    setDrag(true);
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    handle(y);
  };
  useEffect(() => {
    if (!drag) return;
    const m = (e) => handle(e.touches ? e.touches[0].clientY : e.clientY);
    const u = () => setDrag(false);
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    window.addEventListener('touchmove', m);
    window.addEventListener('touchend', u);
    return () => {
      window.removeEventListener('mousemove', m);
      window.removeEventListener('mouseup', u);
      window.removeEventListener('touchmove', m);
      window.removeEventListener('touchend', u);
    };
  }, [drag]);

  const pct = (value - min) / (max - min);

  return (
    <div className="dial-col">
      <div className="dial-label">{label}</div>
      <div
        ref={ref}
        className="dial-track"
        onMouseDown={onDown}
        onTouchStart={onDown}
      >
        <div className="dial-track-bg" />
        <div
          className="dial-track-fill"
          style={{ height: `${pct * 100}%` }}
        />
        <div
          className="dial-thumb"
          style={{ bottom: `calc(${pct * 100}% - 1px)` }}
        />
      </div>
      <div className="dial-value">
        {typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}
        <span className="dial-suffix">{suffix}</span>
      </div>
    </div>
  );
}

function ModePill({ active, label, onClick }) {
  return (
    <button className={`mode-pill ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mode-dot" />
      {label}
    </button>
  );
}

// Preset modes mapped to participation %
const PRESETS = [
  { id: 'manual',    value: 10, label: 'Manual' },
  { id: 'coexist',   value: 40, label: 'Coexist' },
  { id: 'ambient',   value: 70, label: 'Ambient' },
  { id: 'invisible', value: 95, label: 'Invisible' },
];

// Presence picker — sits in the top bar.  Four tappable mode dots + ring.
// Tap a dot to jump to that mode; the active label sits under the ring.
function PresencePicker({ value, onChange }) {
  // value 0–1
  const size = 38;
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  const v = value * 100;
  // active preset = nearest by value
  const activeIdx = PRESETS.reduce(
    (best, p, i) => Math.abs(p.value - v) < Math.abs(PRESETS[best].value - v) ? i : best, 0
  );
  return (
    <div className="presence-picker">
      <div className="preset-rail">
        <div className="preset-rail-label">{PRESETS[activeIdx].label.toLowerCase()}</div>
        <div className="preset-dots">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              className={`preset-dot ${i === activeIdx ? 'on' : ''}`}
              onClick={() => onChange(p.value / 100)}
              aria-label={p.label}
            >
              <span className="preset-dot-inner" />
              <span className="preset-dot-tip">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ai-ring" title="AI participation">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#ringGrad)" strokeWidth="1.5"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9be9ff" />
            <stop offset="100%" stopColor="#b6ffe3" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ai-ring-text">
        <div className="ai-ring-pct">{Math.round(value * 100)}</div>
        <div className="ai-ring-cap">AI</div>
      </div>
    </div>
    </div>
  );
}

// ── status phrases ────────────────────────────────────────────────────────

const AMBIENT_LINES = [
  'Air feels calm',
  'Humidity balanced',
  'Living atmosphere stable',
  'Ventilation flowing softly',
  'Purifier in quiet mode',
  'Comfort is maintained',
];

function AmbientCycle() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % AMBIENT_LINES.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ambient-cycle">
      {AMBIENT_LINES.map((l, idx) => (
        <span
          key={idx}
          className={`ambient-line ${idx === i ? 'on' : ''}`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

// Devices currently being managed — minimal nodes, never dashboard chips
function DeviceField({ presence }) {
  const devices = [
    { id: 'ceiling', name: 'Ceiling Climate', state: 'softening · 22.4°' },
    { id: 'purify',  name: 'Purifier',        state: 'quiet · PM 4' },
    { id: 'vent',    name: 'Ventilation',     state: 'inflow 0.6 m/s' },
    { id: 'humid',   name: 'Humidifier',      state: 'holding 41%' },
  ];
  return (
    <div className="device-field">
      {devices.map((d, idx) => (
        <div key={d.id} className="device-node" style={{ animationDelay: `${idx * 0.4}s` }}>
          <div className="device-glyph">
            <span className="device-pulse" />
          </div>
          <div className="device-meta">
            <div className="device-name">{d.name}</div>
            <div className="device-state">{d.state}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Clock
function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// ── main ──────────────────────────────────────────────────────────────────

const PHRASES = {
  breathes: 'The house breathes with you.',
  calm: 'The room is keeping itself calm.',
  evening: 'Evening air, softened.',
  invisible: 'Tended by what you cannot see.',
};

// Draggable vertical handle sitting exactly at the AI/user boundary.
// Lets the user reshape the room by dragging — the most direct interface to the core concept.
function BoundaryHandle({ rootRef, presence, onChange, showHint }) {
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);

  const update = (clientX) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const pct = (clientX - r.left) / r.width;            // 0 at left → 1 at right
    onChange(Math.max(0, Math.min(1, 1 - pct)));         // presence grows as boundary moves left
  };

  useEffect(() => {
    if (!drag) return;
    const m = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      update(x);
      e.preventDefault?.();
    };
    const u = () => setDrag(false);
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    window.addEventListener('touchmove', m, { passive: false });
    window.addEventListener('touchend', u);
    return () => {
      window.removeEventListener('mousemove', m);
      window.removeEventListener('mouseup', u);
      window.removeEventListener('touchmove', m);
      window.removeEventListener('touchend', u);
    };
  }, [drag]);

  const onDown = (e) => {
    setDrag(true);
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    update(x);
  };

  const left = `${(1 - presence) * 100}%`;
  return (
    <div
      className={`boundary-handle ${drag ? 'drag' : ''} ${hover ? 'hover' : ''}`}
      style={{ left }}
      onMouseDown={onDown}
      onTouchStart={onDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="separator"
      aria-label="Adjust AI presence"
    >
      <div className="boundary-line" />
      <div className="boundary-grip">
        <span /><span /><span />
      </div>
      <div className="boundary-readout">
        <span className="boundary-readout-num">{Math.round(presence * 100)}</span>
        <span className="boundary-readout-cap">AI presence</span>
      </div>
      {showHint && (
        <div className="boundary-hint">drag to reshape the room</div>
      )}
    </div>
  );
}

function Climate({ tweaks, setTweak }) {
  const t = tweaks;
  const [temp, setTemp] = useState(22);
  const [fan, setFan] = useState(35);
  const [humid, setHumid] = useState(41);
  const [mode, setMode] = useState('auto');
  const [override, setOverride] = useState(false);
  const [hintSeen, setHintSeen] = useState(false);
  const rootRef = useRef(null);

  const setPresence = (v01) => {
    const v = Math.round(Math.max(0, Math.min(100, v01 * 100)));
    setTweak('presence', v);
    if (!hintSeen) setHintSeen(true);
  };

  // The hero phrase fades on a slow breath
  const phrase = PHRASES[t.phrase] || PHRASES.breathes;

  const presence = t.presence / 100;
  // Boundary positions in % — used for control opacity + atmosphere extent
  const controlOpacity = useMemo(() => {
    // controls become more transparent as AI takes over
    // at 30% AI → ~0.95, at 70% AI → ~0.62, at 100% → ~0.35
    return Math.max(0.32, 1 - presence * 0.65);
  }, [presence]);

  const controlScale = useMemo(() => 1 - presence * 0.06, [presence]);

  const clock = useClock();
  const hh = String(clock.getHours()).padStart(2, '0');
  const mm = String(clock.getMinutes()).padStart(2, '0');

  // Override flash
  useEffect(() => {
    if (!override) return;
    const id = setTimeout(() => setOverride(false), 1800);
    return () => clearTimeout(id);
  }, [override]);

  return (
    <div className="climate-root" ref={rootRef}>
      {/* Aurora canvas fills the whole frame; presence shapes its leftmost extent */}
      <AuroraCanvas
        presence={presence}
        hueShift={t.hueShift}
        intensity={t.intensity}
        paused={t.paused}
      />

      {/* Top status bar — single thin row */}
      <div className="top-bar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">aether<span className="brand-dim">·home</span></span>
        </div>
        <div className="top-meta">
          <span className="top-time">{hh}:{mm}</span>
          <span className="top-divider" />
          <span className="top-loc">Living Room · 22.4° · 41% RH</span>
        </div>
        <PresencePicker value={presence} onChange={setPresence} />
      </div>

      {/* Boundary drag handle — sits exactly at the AI/user seam. Drag horizontally to reshape the room. */}
      <BoundaryHandle
        rootRef={rootRef}
        presence={presence}
        onChange={setPresence}
        showHint={!hintSeen}
      />

      {/* LEFT — tactile control zone */}
      <div
        className={`control-zone ${presence <= 0.75 ? 'with-details' : ''}`}
        style={{
          opacity: controlOpacity,
          width: presence <= 0.75
            ? `${Math.max(380, 620 - presence * 320)}px`     // wide when details show, gently shrinks
            : `${360 - presence * 200}px`,                   // compact, shrinks with presence
        }}
      >
        <div className="ctl-header">
          <div className="ctl-eyebrow">Indoor · Living Room</div>
          <div className="ctl-temp">
            <span className="ctl-temp-num">{temp.toFixed(1)}</span>
            <span className="ctl-temp-deg">°</span>
          </div>
          <div className="ctl-temp-sub">
            <span className="ctl-arrow">↓</span> 22.4° now &nbsp;·&nbsp; feels 21.9°
          </div>
        </div>

        <div className="ctl-mid-row">
          <div className="dial-row">
            <Dial label="Temp"  value={temp}  suffix="°"  onChange={setTemp}  min={16} max={30} step={0.5} />
            <Dial label="Flow"  value={fan}   suffix="%"  onChange={setFan}   min={0}  max={100} step={1} />
            <Dial label="Humid" value={humid} suffix="%"  onChange={setHumid} min={20} max={70} step={1} />
          </div>

          {/* Extended details — only shown when the panel has room (AI presence ≤ 75%) */}
          {presence <= 0.75 && (
            <div className="ctl-details">
              {/* Outdoor weather strip */}
              <div className="ctl-outdoor">
                <div className="ctl-row-label">Outdoor</div>
                <div className="ctl-outdoor-main">
                  <span className="ctl-outdoor-temp">12°</span>
                  <span className="ctl-outdoor-cond">overcast</span>
                </div>
                <div className="ctl-outdoor-meta">
                  <span>aqi <b>28</b></span>
                  <span>wind <b>4 km/h</b></span>
                  <span>uv <b>2</b></span>
                </div>
              </div>

              {/* Per-device live status */}
              <div className="ctl-devices">
                <div className="ctl-row-label">Devices</div>
                <ul className="ctl-device-list">
                  <li>
                    <span className="dot pulse" />
                    <span className="name">Ceiling Climate</span>
                    <span className="state">cooling · 22.4°</span>
                  </li>
                  <li>
                    <span className="dot pulse" />
                    <span className="name">Purifier</span>
                    <span className="state">quiet · pm 4</span>
                  </li>
                  <li>
                    <span className="dot pulse" />
                    <span className="name">Ventilation</span>
                    <span className="state">inflow · 0.6 m/s</span>
                  </li>
                  <li>
                    <span className="dot pulse" />
                    <span className="name">Humidifier</span>
                    <span className="state">holding · 41%</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="mode-row">
          {['auto', 'cool', 'purify', 'quiet'].map((m) => (
            <ModePill
              key={m}
              active={mode === m}
              label={m.toUpperCase()}
              onClick={() => setMode(m)}
            />
          ))}
        </div>

        <button
          className={`override ${override ? 'flashing' : ''}`}
          onClick={() => setOverride(true)}
        >
          <span className="override-hint">hold to</span>
          <span className="override-lbl">take control</span>
        </button>
      </div>

      {/* RIGHT — atmosphere zone */}
      <div
        className="atmos-zone"
        style={{ left: `calc(${(1 - presence) * 100}% - 60px)` }}
      >
        {/* Soft horizontal breath line */}
        <div className="breath-line">
          <span />
        </div>

        {/* Hero phrase, centered in the right field */}
        <div className="hero-phrase">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            ambient intelligence · attending
          </div>
          <div className="hero-text">{phrase}</div>
          <AmbientCycle />
        </div>

        {/* Bottom of atmosphere: device field — devices the AI is currently shaping */}
        <DeviceField presence={presence} />
      </div>

      {/* Override flash overlay */}
      {override && <div className="override-flash">you are in control</div>}

      {/* Optional gridline spec overlay */}
      {t.showGrid && (
        <div className="spec-grid">
          <div className="grid-v" style={{ left: '30%' }}><span>30%</span></div>
          <div className="grid-v" style={{ left: `${(1 - presence) * 100}%` }}><span>{Math.round((1 - presence) * 100)}% / {Math.round(presence * 100)}%</span></div>
          <div className="grid-h" style={{ top: '50%' }} />
        </div>
      )}
    </div>
  );
}

window.Climate = Climate;
