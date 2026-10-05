import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine, TIME_LIMITS, type TimeLimit } from './engine/game/engine';
import { createKeyListener } from './engine/input/keyboard';
import { isReservedLetter } from './engine/input/shortcuts';
import { ImeWatcher } from './engine/input/ime';
import { createStage, fitScale, KEYBOARD_RESERVE, VIEW_H, VIEW_W } from './render/canvas';
import { getLine, LINES, DEFAULT_LINE_ID } from './data/lines';
import { bestFare, loadSave, recordScore, updateSettings } from './storage/save';
import { useEngineSnapshot } from './ui/hooks/useGameEngine';
import { PlayScreen } from './ui/screens/PlayScreen';
import { TitleScreen } from './ui/screens/TitleScreen';
import { ConfigScreen } from './ui/screens/ConfigScreen';
import { LineSelectScreen } from './ui/screens/LineSelectScreen';
import { CountdownScreen } from './ui/screens/CountdownScreen';
import { PauseScreen } from './ui/screens/PauseScreen';
import { Ticket } from './ui/components/Ticket';
import { ImeWarning } from './ui/components/ImeWarning';
import { Keyboard } from './ui/components/Keyboard';
import type { RunSummary } from './engine/game/scoring';
import { isMuted, setMuted, setVolumes, unlock } from './audio/context';
import { playBgm } from './audio/music';

export function App() {
  const [lineId, setLineId] = useState<string>(DEFAULT_LINE_ID);
  const line = useMemo(() => getLine(lineId), [lineId]);
  const settings = useMemo(() => loadSave().settings, []);
  const [timeLimit, setTimeLimitState] = useState<TimeLimit>(settings.defaultTimeLimit);

  // ハイスコアは「路線 × 秒数」で分かれているので、時間を変えたら表示も切り替える
  const [best, setBest] = useState<number | null>(() => bestFare(DEFAULT_LINE_ID, settings.defaultTimeLimit));

  /**
   * 路線と秒数を引数で受け取る（state を閉じ込めない）。
   * ここで lineId を閉じ込めると onFinish の同一性が変わり、
   * 下の GameEngine が作り直されてゲームが巻き戻る。
   */
  const refreshBest = useCallback((lineId: string, t: TimeLimit) => {
    setBest(bestFare(lineId, t));
  }, []);

  // 最新の値を見たいが、engine の同一性は変えたくないので ref 経由にする
  const onFinishRef = useRef<(s: RunSummary) => boolean>(() => false);
  onFinishRef.current = (s: RunSummary): boolean => {
    const isBest = recordScore(s.lineId, s.timeLimit as TimeLimit, {
      fare: s.fare, baseFare: s.baseFare, bonus: s.bonus,
      reachedKanji: s.reachedKanji, reachedCount: s.reachedCount, km: s.km,
      keystrokes: s.keystrokes, correct: s.correct, misses: s.misses,
      accuracy: s.accuracy, kpm: s.kpm, maxCombo: s.maxCombo, laps: s.laps,
      passengers: s.passengers, playedAt: Date.now(),
    }, s.elapsedSec);
    refreshBest(s.lineId, s.timeLimit as TimeLimit);
    return isBest;
  };

  /**
   * GameEngine は**一度だけ**作る。
   * 依存配列に state を入れると、路線や秒数を変えるたびに作り直されて
   * フェーズがタイトルに戻ってしまう（実際にその不具合を出した）。
   */
  const engine = useMemo(
    () => new GameEngine({
      line: getLine(DEFAULT_LINE_ID),
      timeLimit: settings.defaultTimeLimit,
      showRomaji: settings.showRomaji,
      onFinish: (s) => onFinishRef.current(s),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const snap = useEngineSnapshot(engine);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const pointerCoarse = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );

  const chooseTime = useCallback((t: TimeLimit) => {
    setTimeLimitState(t);
    engine.setTimeLimit(t);
    updateSettings({ defaultTimeLimit: t });
    refreshBest(engine.currentLineId, t);
  }, [engine, refreshBest]);

  const chooseLine = useCallback((index: number) => {
    const next = LINES[index]!;
    setLineId(next.id);
    engine.setLine(next, index);
    refreshBest(next.id, engine.currentTimeLimit);
  }, [engine, refreshBest]);

  const [muted, setMutedState] = useState<boolean>(() => settings.muted);
  const toggleMute = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    updateSettings({ muted: next });
  }, []);

  /**
   * 画面下のローマ字キーボード。既定は表示。
   * 出すとステージが一段小さくなるので、慣れた人は消せるようにしてある。
   */
  const [showKeyboard, setShowKeyboard] = useState<boolean>(() => settings.showKeyboard);
  const toggleKeyboard = useCallback(() => {
    setShowKeyboard((v) => {
      updateSettings({ showKeyboard: !v });
      return !v;
    });
  }, []);

  // Canvas を engine に繋ぐ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const stage = createStage(canvas);
    engine.attach(stage.ctx);

    const resize = () => {
      const box = stageRef.current;
      const outer = appRef.current;
      if (box === null || outer === null) return;
      // キーボードを出すときは、その高さを先に差し引いて倍率を決める。
      // あとから引くと 1 段ぶん縦にはみ出す。
      const reserve = showKeyboard ? KEYBOARD_RESERVE : 0;
      const scale = fitScale(outer.clientWidth - 8, outer.clientHeight - 14, reserve);
      stage.scale = scale;
      box.style.width = `${VIEW_W * scale}px`;
      box.style.height = `${VIEW_H * scale}px`;
      box.style.setProperty('--scale', String(scale));
      // キーボードはステージ幅を基準に組むので、外側へも伝える
      outer.style.setProperty('--stage-w', `${VIEW_W * scale}px`);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (appRef.current !== null) ro.observe(appRef.current);
    return () => { ro.disconnect(); engine.detach(); };
  }, [engine, showKeyboard]);

  // 音量を保存された設定から反映する
  useEffect(() => {
    setVolumes(settings.seVolume, settings.bgmVolume);
    setMuted(settings.muted);
  }, [settings]);

  /**
   * IME 監視は**アプリ全体で1つ**にする。
   * 以前は監視用と keydown 用で別インスタンスを作っていたため、
   * keydown 側が「変換中ではない」と判断しても engine に伝わらず、
   * 英数に戻しても警告が消えない（再読み込みが必要）不具合になっていた。
   */
  const ime = useMemo(() => new ImeWatcher(), []);

  // IME 監視
  useEffect(() => {
    const watcher = ime;
    watcher.attach();
    const unsub = watcher.subscribe((on) => engine.setImeOn(on));
    const refocus = () => watcher.refocus();
    window.addEventListener('pointerdown', refocus);
    window.addEventListener('focus', refocus);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', refocus);
      window.removeEventListener('focus', refocus);
      watcher.detach();
    };
  }, [engine, ime]);

  // キーボード
  useEffect(() => {
    const watcher = ime;

    const runPauseAction = () => {
      switch (engine.pauseSelection) {
        case 'resume': engine.setPaused(false); break;
        case 'restart': engine.restart(); break;
        case 'keyboard': toggleKeyboard(); break;
        case 'mute': toggleMute(); break;
        case 'title': engine.backToTitle(); break;
      }
    };

    const listener = createKeyListener(
      {
        onChar: (key) => {
          // ブラウザは操作なしに音を鳴らせないので、最初の打鍵で解禁する
          unlock();
          const phase = engine.currentPhase;
          const k = key.toLowerCase();
          // 文字キーの予約は shortcuts.ts に集約してある。
          // 駅名入力中は1文字も予約しない（ま行を含む駅が打てなくなるため）。
          if (k === 'm' && isReservedLetter(k, phase)) { toggleMute(); return; }
          if (phase === 'result') {
            if (k === 'r') engine.restart();
            return;
          }
          // 一時停止中はメニューのショートカットとして扱う（打鍵にはしない）
          if (engine.isPaused) {
            if (k === 'r') engine.restart();
            else if (k === 't') engine.backToTitle();
            else if (k === 'k') toggleKeyboard();
            return;
          }
          engine.handleChar(key);
        },
        onCommand: (key) => {
          unlock();
          const phase = engine.currentPhase;

          if (engine.isPaused && phase !== 'result') {
            if (key === 'ArrowUp') engine.movePauseCursor(-1);
            else if (key === 'ArrowDown') engine.movePauseCursor(1);
            else if (key === 'Enter') runPauseAction();
            else if (key === 'Escape') engine.setPaused(false);
            return;
          }

          switch (phase) {
            case 'title':
              if (key === ' ' || key === 'Enter') {
                playBgm('__title');
                engine.openLineSelect();
              }
              break;
            case 'lineSelect': {
              if (key === 'ArrowUp') {
                engine.moveLineCursor(-1, LINES.length);
                chooseLine((engine.lineCursor));
              } else if (key === 'ArrowDown') {
                engine.moveLineCursor(1, LINES.length);
                chooseLine((engine.lineCursor));
              } else if (key === 'Enter' || key === ' ') {
                engine.openConfig();
              } else if (key === 'Escape') {
                engine.backToTitle();
              }
              break;
            }
            case 'config': {
              const i = TIME_LIMITS.indexOf(timeLimit);
              if (key === 'ArrowLeft') chooseTime(TIME_LIMITS[Math.max(0, i - 1)]!);
              else if (key === 'ArrowRight') chooseTime(TIME_LIMITS[Math.min(TIME_LIMITS.length - 1, i + 1)]!);
              else if (key === 'Enter' || key === ' ') engine.start();
              else if (key === 'Escape') engine.openLineSelect();
              break;
            }
            // カウントダウン中・折り返し中も止められるようにする。
            // 「今は押しても効かない瞬間」があると、やめられないと思われる。
            case 'countdown':
            case 'turnaround':
            case 'atStation':
            case 'departing':
              if (key === 'Escape') engine.setPaused(true);
              break;
            case 'result':
              if (key === 'Escape') engine.backToTitle();
              break;
          }
        },
      },
      (e) => watcher.inspectKeydown(e),
    );
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [engine, timeLimit, chooseTime, ime, chooseLine, toggleMute, toggleKeyboard]);

  // タブが隠れたら自動ポーズ
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && (engine.currentPhase === 'atStation' || engine.currentPhase === 'departing')) {
        engine.setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [engine]);

  const retro = settings.retroEffects;
  const playing = snap.phase === 'atStation' || snap.phase === 'departing' || snap.phase === 'turnaround';

  return (
    <div className="app" ref={appRef}>
      <div ref={stageRef} className={`stage${retro ? ' scanlines vignette' : ''}`}>
        <canvas ref={canvasRef} />

        {playing && <PlayScreen snap={snap} />}

        {snap.phase === 'title' && (
          <TitleScreen
            best={best}
            lineName={line.nameJp}
            lineKana={line.nameKana}
            destination={line.destination}
            timeLimit={timeLimit}
            pointerCoarse={pointerCoarse}
          />
        )}

        {snap.phase === 'lineSelect' && (
          <LineSelectScreen
            lines={LINES}
            index={snap.lineIndex}
            bestOf={(id) => bestFare(id, timeLimit)}
          />
        )}

        {snap.phase === 'config' && (
          <ConfigScreen
            selected={timeLimit}
            best={best}
            lineName={line.nameJp}
            destination={line.destination}
            scopeNote={line.scopeNote ?? ''}
          />
        )}

        {snap.phase === 'countdown' && !snap.paused && (
          <CountdownScreen
            count={snap.countdown}
            departureCall={snap.departureCall}
            lineName={line.nameJp}
            destination={line.destination}
          />
        )}

        {snap.phase === 'result' && snap.summary !== null && (
          <Ticket summary={snap.summary} lineColor={line.lineColor} isNewRecord={snap.isNewRecord} />
        )}

        {muted && <div className="mute-badge">🔇 ミュート中（M でもどす）</div>}

        {snap.imeOn && <ImeWarning />}
        {snap.paused && !snap.imeOn && snap.phase !== 'result' && (
          <PauseScreen index={snap.pauseIndex} />
        )}
      </div>

      {/*
        ローマ字を覚えている途中の子は、次のキーを探すのに手元を見てしまい
        画面の駅名を見失う。次に押せるキーをここで光らせる。
      */}
      {showKeyboard && (
        <Keyboard
          expected={snap.expectedKeys}
          miss={snap.missFlash}
          active={snap.phase === 'atStation' && !snap.paused && !snap.imeOn}
        />
      )}
    </div>
  );
}
