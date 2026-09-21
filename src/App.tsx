import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { GameCanvas } from './components/GameCanvas';
import { createAudio } from './game/audio';
import { clamp, createGame, DIFFICULTIES, DURATION } from './game/engine';
import type { Difficulty, GameInput, GameState, Mode } from './game/types';
import { resolveLocale, translate, type Locale } from './i18n';

const modes: Mode[] = ['foot', 'bike', 'armor'];
const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
const directionNames = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
const controlledKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
  'Space',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]);

function savedLocale(): Locale {
  try {
    return resolveLocale(localStorage.getItem('evade45.locale'), navigator.languages);
  } catch {
    return resolveLocale(null, navigator.languages);
  }
}

export function App() {
  const [mode, setMode] = useState<Mode>('foot');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [locale, setLocale] = useState<Locale>(savedLocale);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion:reduce)').matches,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const helpDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const gameRef = useRef<GameState>(createGame());
  const inputRef = useRef<GameInput>({ forward: 0, right: 0, boost: false, jump: false });
  const reducedMotionRef = useRef(reducedMotion);
  const audioRef = useRef(createAudio());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef({ forward: 0, right: 0, boost: false, jump: false });
  const frameRef = useRef({ ui: 0, last: 0, damage: 0, passes: 0, status: 'ready' });
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const stickRef = useRef<number | null>(null);
  const coarse = useMemo(() => matchMedia('(pointer:coarse)').matches, []);
  const game = gameRef.current;
  const t = useCallback(
    (key: string, values: Record<string, string | number> = {}) => translate(locale, key, values),
    [locale],
  );

  useEffect(() => {
    const dialog = helpDialogRef.current;
    if (!dialog) return;
    // showModal places the dialog above the game layers and activates its backdrop.
    if (helpOpen && !dialog.open) dialog.showModal();
    else if (!helpOpen && dialog.open) dialog.close();
  }, [helpOpen]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('page.title');
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', t('page.description'));
    try {
      localStorage.setItem('evade45.locale', locale);
    } catch {}
  }, [locale, t]);
  useEffect(() => () => audioRef.current.destroy(), []);

  const rebuildInput = useCallback(() => {
    const keys = keysRef.current,
      touch = touchRef.current;
    inputRef.current = {
      forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + touch.forward,
      right: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touch.right,
      boost: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost,
      jump: keys.has('Space') || touch.jump,
    };
  }, []);
  const clearInput = useCallback(() => {
    keysRef.current.clear();
    Object.assign(touchRef.current, { forward: 0, right: 0, boost: false, jump: false });
    dragRef.current = null;
    stickRef.current = null;
    rebuildInput();
  }, [rebuildInput]);
  const releaseMouse = useCallback(() => {
    if (document.pointerLockElement === canvasRef.current) document.exitPointerLock();
  }, []);
  const lockMouse = useCallback(() => {
    const canvas = canvasRef.current;
    if (coarse || !canvas?.requestPointerLock) return;
    try {
      void canvas.requestPointerLock();
    } catch {}
  }, [coarse]);
  const enableAudio = useCallback(
    async (force = false) => {
      if (!soundEnabled && !force) return;
      const ok = await audioRef.current.unlock();
      setAudioUnavailable(!ok);
      if (!ok) {
        setSoundEnabled(false);
        audioRef.current.setEnabled(false);
      }
    },
    [soundEnabled],
  );
  const commit = useCallback((next: GameState) => {
    gameRef.current = next;
    frameRef.current.status = next.status;
    refresh();
  }, []);
  const start = useCallback(
    (withLock = true) => {
      clearInput();
      const next = createGame(mode, difficulty);
      next.status = 'playing';
      commit(next);
      canvasRef.current?.focus({ preventScroll: true });
      void enableAudio();
      if (withLock) lockMouse();
    },
    [clearInput, commit, difficulty, enableAudio, lockMouse, mode],
  );
  const pause = useCallback(() => {
    const current = gameRef.current;
    if (current.status !== 'playing') return;
    current.status = 'paused';
    clearInput();
    audioRef.current.suspend();
    releaseMouse();
    refresh();
  }, [clearInput, releaseMouse]);
  const resume = useCallback(() => {
    const current = gameRef.current;
    if (current.status !== 'paused') return;
    clearInput();
    current.status = 'playing';
    frameRef.current.status = 'playing';
    refresh();
    canvasRef.current?.focus({ preventScroll: true });
    void enableAudio();
    lockMouse();
  }, [clearInput, enableAudio, lockMouse]);
  const setup = useCallback(() => {
    clearInput();
    releaseMouse();
    audioRef.current.suspend();
    commit(createGame(mode, difficulty));
  }, [clearInput, commit, difficulty, mode, releaseMouse]);
  const selectMode = useCallback(
    (next: Mode) => {
      if (gameRef.current.status === 'ready') {
        setMode(next);
        commit(createGame(next, difficulty));
      }
    },
    [commit, difficulty],
  );
  const selectDifficulty = useCallback(
    (next: Difficulty) => {
      if (gameRef.current.status === 'ready') {
        setDifficulty(next);
        commit(createGame(mode, next));
      }
    },
    [commit, mode],
  );
  const look = useCallback((dx: number, dy: number) => {
    const p = gameRef.current.player;
    p.yaw -= dx * 0.0025;
    p.pitch = clamp(p.pitch - dy * 0.0022, -1.18, 1.3);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (helpOpen || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (gameRef.current.status === 'playing' && controlledKeys.has(event.code)) {
        event.preventDefault();
        keysRef.current.add(event.code);
        rebuildInput();
      }
    };
    const up = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
      rebuildInput();
    };
    const move = (event: MouseEvent) => {
      if (gameRef.current.status === 'playing' && document.pointerLockElement === canvasRef.current)
        look(event.movementX, event.movementY);
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', move);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [helpOpen, look, pause, rebuildInput]);

  const onFrame = useCallback(
    (current: GameState, time: number) => {
      const frame = frameRef.current;
      const dt = Math.min(0.1, Math.max(0, time - frame.last));
      frame.last = time;
      if (current.status === 'playing') {
        if (keysRef.current.has('ArrowLeft')) current.player.yaw += dt * 1.8;
        if (keysRef.current.has('ArrowRight')) current.player.yaw -= dt * 1.8;
        if (keysRef.current.has('ArrowUp'))
          current.player.pitch = clamp(current.player.pitch + dt * 1.3, -1.18, 1.3);
        if (keysRef.current.has('ArrowDown'))
          current.player.pitch = clamp(current.player.pitch - dt * 1.3, -1.18, 1.3);
      }
      if (current.damageCount !== frame.damage) {
        audioRef.current.impact();
        frame.damage = current.damageCount;
      }
      if (current.passCount !== frame.passes) {
        audioRef.current.passBy(current.lastPass?.side ?? 0);
        frame.passes = current.passCount;
      }
      if (current.status !== frame.status) {
        frame.status = current.status;
        if (current.status === 'lost' || current.status === 'won') {
          clearInput();
          releaseMouse();
          audioRef.current.suspend();
        }
        refresh();
      }
      if (time - frame.ui > 0.06) {
        frame.ui = time;
        audioRef.current.update(current, time);
        refresh();
      }
    },
    [clearInput, releaseMouse],
  );

  const canvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (game.status !== 'playing' || document.pointerLockElement === canvasRef.current) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const canvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || game.status !== 'playing') return;
    look(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  const stopDrag = () => {
    dragRef.current = null;
  };
  const moveStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickRef.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2,
      dy = event.clientY - rect.top - rect.height / 2,
      limit = rect.width * 0.32,
      length = Math.max(limit, Math.hypot(dx, dy));
    touchRef.current.right = dx / length;
    touchRef.current.forward = -dy / length;
    rebuildInput();
    const knob = event.currentTarget.firstElementChild as HTMLElement;
    knob.style.transform = `translate(${(dx / length) * limit}px,${(dy / length) * limit}px)`;
  };
  const stopStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickRef.current !== event.pointerId) return;
    stickRef.current = null;
    touchRef.current.forward = touchRef.current.right = 0;
    rebuildInput();
    (event.currentTarget.firstElementChild as HTMLElement).style.transform = 'translate(0,0)';
  };
  const holdAction = (key: 'boost' | 'jump', value: boolean) => {
    touchRef.current[key] = value;
    rebuildInput();
  };

  const p = game.player,
    remaining = Math.max(0, DURATION - game.elapsed)
      .toFixed(1)
      .split('.');
  const compassIndex = ((Math.round(p.yaw / (Math.PI / 4)) % 8) + 8) % 8;
  const closest = [...game.drones].sort(
    (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )[0];
  const won = game.status === 'won';
  const resultValues = {
    mode: t(`mode.${mode}`),
    difficulty: t(`difficulty.${difficulty}`),
    time: game.elapsed.toFixed(1),
  };
  const integrity =
    mode === 'armor'
      ? t('hud.armor', { health: p.health }) + (p.invulnerable > 0 ? t('hud.hit') : '')
      : mode === 'foot'
        ? t(
            p.altitude > 0.05
              ? 'hud.airborne'
              : p.jumpCooldown > 0
                ? 'hud.jumpCooldown'
                : 'hud.jumpReady',
          )
        : t('hud.oneHit');

  return (
    <main
      id="experience"
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={canvasPointerDown}
      onPointerMove={canvasPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onClick={() => {
        if (game.status === 'playing' && !coarse && !document.pointerLockElement) lockMouse();
      }}
    >
      <GameCanvas
        gameRef={gameRef}
        inputRef={inputRef}
        reducedMotionRef={reducedMotionRef}
        onFrame={onFrame}
        onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
          setLoading(false);
        }}
        onContextLost={() => {
          pause();
          setContextLost(true);
        }}
      />
      <div className="vignette" aria-hidden="true" />
      <div
        id="damage-flash"
        style={{ opacity: p.invulnerable > 0 ? Math.min(0.9, p.invulnerable * 0.4) : 0 }}
      />
      <div
        id="pass-flash"
        style={{
          opacity:
            !reducedMotion && game.lastPass
              ? Math.max(0, 1 - (game.elapsed - game.lastPass.time) * 3) * 0.42
              : 0,
        }}
      />
      {loading && (
        <div id="loading">
          <span className="loading-brand">EVADE 45</span>
          <p>{t('loading')}</p>
          <div className="loading-line" />
        </div>
      )}
      <header className="topbar">
        <a className="brand" href="./">
          <span className="brand-cross">⌖</span> EVADE 45
          <span className="brand-small">{t('brand.subtitle')}</span>
        </a>
        <div className="header-right">
          <span className="live-label">
            <i />
            {t('header.live')}
          </span>
          <a
            className="github-link"
            href="https://github.com/TigerWest/evade45"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            draggable={false}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              pause();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.974-.015-1.912-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.077-.685.077-.685 1.13.08 1.725 1.16 1.725 1.16 1.004 1.72 2.634 1.223 3.276.935.102-.727.393-1.223.715-1.504-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.234 1.16-3.022-.116-.285-.503-1.43.11-2.98 0 0 .945-.303 3.094 1.154A10.79 10.79 0 0 1 12 6.18c.956.004 1.918.129 2.815.378 2.148-1.457 3.09-1.154 3.09-1.154.616 1.55.23 2.695.114 2.98.722.788 1.158 1.792 1.158 3.022 0 4.326-2.631 5.278-5.138 5.557.404.35.764 1.043.764 2.1 0 1.516-.014 2.739-.014 3.11 0 .3.202.651.774.541A11.251 11.251 0 0 0 12 .75Z" />
            </svg>
            <span>GitHub</span>
          </a>
          <select
            id="language-select"
            value={locale}
            aria-label={t('language.label')}
            onFocus={pause}
            onChange={(event) => setLocale(resolveLocale(event.target.value))}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
          <button
            id="audio-button"
            aria-pressed={soundEnabled}
            aria-label={t(soundEnabled ? 'audio.mute' : 'audio.unmute')}
            onClick={async () => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              setAudioUnavailable(false);
              audioRef.current.setEnabled(next);
              if (next) await enableAudio(true);
            }}
          >
            {t(audioUnavailable ? 'audio.unavailable' : soundEnabled ? 'audio.on' : 'audio.off')}
          </button>
          <button
            id="help-button"
            aria-label={t('help.openLabel')}
            onClick={() => {
              pause();
              setHelpOpen(true);
            }}
          >
            <span className="button-label">{t('help.open')}</span>
            <span>↗</span>
          </button>
          {game.status === 'playing' && (
            <button
              id="pause-button"
              aria-label={t('pause.label')}
              onClick={(event) => {
                event.stopPropagation();
                pause();
              }}
            >
              Ⅱ
            </button>
          )}
        </div>
      </header>
      {game.status === 'ready' && (
        <section id="menu" className="menu">
          <div className="intro">
            <div className="eyebrow">
              <i />
              <span>{t('intro.kicker')}</span>
            </div>
            <h1>{t('intro.title')}</h1>
            <p>{t('intro.description')}</p>
            <div className="audio-note">
              <span>◖</span>
              <span>{t('intro.audio')}</span>
            </div>
          </div>
          <div className="launch-panel">
            <div className="loadout-heading">
              <h2>{t('setup.title')}</h2>
              <span>{t('setup.subtitle')}</span>
            </div>
            <div className="loadouts" role="group" aria-label={t('setup.title')}>
              {modes.map((item, index) => (
                <button
                  key={item}
                  data-mode={item}
                  className={mode === item ? 'selected' : ''}
                  aria-pressed={mode === item}
                  onClick={() => selectMode(item)}
                >
                  <span className="loadout-num">0{index + 1}</span>
                  <div>
                    <strong>{t(`mode.${item}`)}</strong>
                    <small>{t(`mode.${item}.description`)}</small>
                  </div>
                  <span className="check">{mode === item ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <div className="launch-bottom">
              <div className="difficulty-wrap">
                <span>{t('difficulty.label')}</span>
                <div className="difficulty" role="group">
                  {difficulties.map((item) => (
                    <button
                      key={item}
                      data-difficulty={item}
                      className={difficulty === item ? 'selected' : ''}
                      aria-pressed={difficulty === item}
                      onClick={() => selectDifficulty(item)}
                    >
                      {t(`difficulty.${item}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                id="start-button"
                className="primary-button"
                onClick={(event) => {
                  event.stopPropagation();
                  start();
                }}
              >
                <span className="button-label">{t('start')}</span>
                <span>↗</span>
              </button>
            </div>
            <div className="flight-spec">
              <span>
                {t('spec.summary', {
                  speed: Math.round(DIFFICULTIES[difficulty].speed * 3.6),
                  source: DIFFICULTIES[difficulty].source,
                })}
              </span>
              <button id="specs-button" onClick={() => setHelpOpen(true)}>
                {t('spec.open')}
              </button>
            </div>
            <p className="entry-note">
              {t(
                coarse ? 'controls.touch' : mode === 'foot' ? 'controls.foot' : 'controls.vehicle',
              )}
            </p>
          </div>
          <div className="scene-label">
            <span>{t('scene.kicker')}</span>
            <b>{t('scene.title')}</b>
            <small>{t('scene.description')}</small>
          </div>
          <footer>
            <span>{t('footer.note')}</span>
            <span>{t('footer.tagline')}</span>
          </footer>
        </section>
      )}
      {game.status === 'playing' && (
        <section id="hud" aria-label={t('hud.label')}>
          <div className="compass">
            <span>{directionNames[(compassIndex + 1) % 8]}</span>
            <i />
            <span id="compass">{directionNames[compassIndex]}</span>
            <i />
            <span>{directionNames[(compassIndex + 7) % 8]}</span>
          </div>
          <div className="survival-clock">
            <span>{t('hud.survive')}</span>
            <strong>
              {remaining[0]}
              <small>.{remaining[1]}</small>
            </strong>
            <span>{t('hud.seconds')}</span>
          </div>
          <div className="threat-telemetry">
            <span>{t('hud.droneSpeed')}</span>
            <b>
              {closest
                ? `${Math.round(Math.hypot(closest.vx, closest.vy, closest.vz) * 3.6)} km/h`
                : t('hud.waiting')}
            </b>
          </div>
          <div id="crosshair">
            <i />
          </div>
          <div id="warning" style={{ opacity: game.threat > 0.3 || game.boundary ? 1 : 0 }}>
            <span className="warning-bracket">[</span>
            <div>
              <span id="warning-label">
                {t(
                  game.boundary
                    ? 'warning.boundary'
                    : game.threat > 0.95
                      ? 'warning.imminent'
                      : 'warning.approaching',
                )}
              </span>
              <small id="warning-sub">
                {t(
                  game.boundary
                    ? 'warning.boundaryDetail'
                    : game.threat > 0.7
                      ? 'warning.noBraking'
                      : 'warning.direction',
                )}
              </small>
            </div>
            <span className="warning-bracket">]</span>
          </div>
          <div className="bottom-hud">
            <div className="player-state">
              <span>{t(`mode.${mode}`)}</span>
              <div className="energy-heading">
                <span>{t(mode === 'foot' ? 'hud.stamina' : 'hud.boostEnergy')}</span>
                <b>{Math.round(p.energy)}%</b>
              </div>
              <div className="energy-track">
                <i
                  style={{
                    width: `${p.energy}%`,
                    background: p.energy < 20 ? '#f18a58' : '#dfd7af',
                  }}
                />
              </div>
              <small>{integrity}</small>
            </div>
            <div className="live-controls">
              <span>{t(mode === 'foot' ? 'controls.foot.short' : 'controls.vehicle.short')}</span>
              <small>{t('controls.look')}</small>
            </div>
            <div className="speedometer">
              <strong>{Math.round(Math.abs(p.speed) * 3.6)}</strong>
              <span>KM/H</span>
            </div>
          </div>
          <div id="intro-toast" style={{ opacity: game.elapsed < 5 ? 1 : 0 }}>
            {t('hud.intro')}
          </div>
          <div id="look-hint" hidden={document.pointerLockElement === canvasRef.current || coarse}>
            {t('hud.dragLook')}
          </div>
          <div className="mobile-controls">
            <div
              id="joystick"
              aria-label={t('touch.joystick')}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                stickRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                moveStick(event);
              }}
              onPointerMove={moveStick}
              onPointerUp={stopStick}
              onPointerCancel={stopStick}
              onLostPointerCapture={stopStick}
            >
              <i id="joystick-knob" />
            </div>
            <div className="mobile-look-note">{t('touch.look')}</div>
            <div className="mobile-actions">
              {mode === 'foot' && (
                <button
                  id="jump-button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    holdAction('jump', true);
                  }}
                  onPointerUp={() => holdAction('jump', false)}
                  onPointerCancel={() => holdAction('jump', false)}
                  onLostPointerCapture={() => holdAction('jump', false)}
                >
                  <span className="button-label">{t('touch.jump')}</span>
                  <span>SPACE</span>
                </button>
              )}
              <button
                id="boost-button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  holdAction('boost', true);
                }}
                onPointerUp={() => holdAction('boost', false)}
                onPointerCancel={() => holdAction('boost', false)}
                onLostPointerCapture={() => holdAction('boost', false)}
              >
                {t('touch.boost')}
              </button>
            </div>
          </div>
        </section>
      )}
      {game.status === 'paused' && (
        <section id="pause-screen" className="modal-screen">
          <span className="eyebrow">{t('pause.kicker')}</span>
          <h2>{t('pause.title')}</h2>
          <p>{t('pause.description')}</p>
          <button
            id="resume-button"
            className="primary-button"
            onClick={(event) => {
              event.stopPropagation();
              resume();
            }}
          >
            <span className="button-label">{t('pause.resume')}</span>
            <span>→</span>
          </button>
          <button id="quit-button" className="text-button" onClick={setup}>
            {t('pause.quit')}
          </button>
        </section>
      )}
      {(game.status === 'lost' || game.status === 'won') && (
        <section id="result-screen" className="modal-screen" aria-live="polite">
          <span className="eyebrow">
            {t(won ? 'result.wonKicker' : 'result.lostKicker', resultValues)}
          </span>
          <h2>{t(won ? 'result.wonTitle' : 'result.lostTitle')}</h2>
          <p>{t(won ? 'result.wonDescription' : 'result.lostDescription', resultValues)}</p>
          <div className="result-stats">
            <div>
              <span>{t('result.time')}</span>
              <strong>
                {game.elapsed.toFixed(1)}
                <small>s</small>
              </strong>
            </div>
            <div>
              <span>{t('result.dodges')}</span>
              <strong>{game.dodges}</strong>
            </div>
            <div>
              <span>{t('result.distance')}</span>
              <strong>
                {Math.round(game.distance)}
                <small>m</small>
              </strong>
            </div>
          </div>
          <div className="result-actions">
            <button id="retry-button" className="primary-button" onClick={() => start()}>
              <span className="button-label">{t('result.retry')}</span>
              <span>↗</span>
            </button>
            <button id="setup-button" className="secondary-button" onClick={setup}>
              {t('result.setup')}
            </button>
          </div>
          <p className="result-reflection">{t('result.next')}</p>
        </section>
      )}
      {contextLost && (
        <section id="error-screen" className="modal-screen">
          <span className="eyebrow">{t('error.kicker')}</span>
          <h2>{t('error.title')}</h2>
          <p>{t('error.context')}</p>
          <button className="primary-button" onClick={() => location.reload()}>
            <span className="button-label">{t('error.reload')}</span>
            <span>↻</span>
          </button>
        </section>
      )}
      <dialog
        id="help-dialog"
        ref={helpDialogRef}
        aria-labelledby="help-title"
        onClose={() => setHelpOpen(false)}
      >
        <div className="dialog-header">
          <span className="eyebrow">{t('help.kicker')}</span>
          <button aria-label={t('help.close')} onClick={() => setHelpOpen(false)}>
            ✕
          </button>
        </div>
        <h2 id="help-title">{t('help.title')}</h2>
        <p>{t('help.description')}</p>
        <dl>
          <div>
            <dt>W A S D</dt>
            <dd>{t('help.move')}</dd>
          </div>
          <div>
            <dt>{t('help.mouse')}</dt>
            <dd>{t('help.look')}</dd>
          </div>
          <div>
            <dt>SHIFT</dt>
            <dd>{t('help.boost')}</dd>
          </div>
          <div>
            <dt>SPACE</dt>
            <dd>{t('help.jump')}</dd>
          </div>
          <div>
            <dt>ESC</dt>
            <dd>{t('help.escape')}</dd>
          </div>
          <div>
            <dt>{t('help.arrows')}</dt>
            <dd>{t('help.arrowLook')}</dd>
          </div>
        </dl>
        <p className="help-detail">{t('help.flight')}</p>
        <p className="help-detail">{t('help.mobile')}</p>
        <section className="spec-sources">
          <h3>{t('spec.title')}</h3>
          <p>
            <a href="https://www.dji.com/avata-2/specs" target="_blank" rel="noreferrer">
              {t('spec.avataLink')}
            </a>
            <br />
            {t('spec.avata')}
          </p>
          <p>
            <a
              href="https://www.dji.com/newsroom/news/dji-reinvents-the-drone-flying-experience-with-the-dji-fpv"
              target="_blank"
              rel="noreferrer"
            >
              {t('spec.fpvLink')}
            </a>
            <br />
            {t('spec.fpv')}
          </p>
          <p>{t('spec.assumptions')}</p>
        </section>
        <label className="motion-option">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          <span>{t('help.reduceMotion')}</span>
        </label>
        <button
          id="understood-button"
          className="primary-button"
          onClick={() => setHelpOpen(false)}
        >
          <span className="button-label">{t('help.done')}</span>
          <span>→</span>
        </button>
      </dialog>
    </main>
  );
}
