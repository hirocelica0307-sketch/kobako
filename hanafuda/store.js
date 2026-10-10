/* 設定と きろく（この 端末の localStorage に のこします）
   ------------------------------------------------------------------ */
import { DEFAULT_RULES } from './rules.js';

const KEY = 'hanafuda.v1';

export const DISPLAY_DEFAULTS = {
    yakuButton: true,     // 対局中に「役」ボタンを 出す
    progress: true,       // できそうな 役（あと 何枚）を 出す
    hint: true,           // とれる 札を 光らせる
    labels: true,         // 札に 月と 種類の 名札を つける
    recommend: true,      // 「おすすめ」ボタン
    coach: true,          // ひとこと アドバイス
    oneTap: false,        // 1回 タップで 出す
    speed: 'normal',      // slow / normal / fast
    sound: true,          // 効果音
    voice: true           // 「こいこい！」などの こえ
};

export const PRESETS = {
    beginner: { label: 'はじめて', desc: 'ヒントや 名札を ぜんぶ 出します',
        display: { yakuButton: true, progress: true, hint: true, labels: true, recommend: true, coach: true } },
    normal: { label: 'すこし わかる', desc: '役の すすみぐあいと ヒントだけ 出します',
        display: { yakuButton: true, progress: true, hint: true, labels: false, recommend: false, coach: false } },
    expert: { label: 'なれている', desc: 'よけいな 表示を けして すっきり あそびます',
        display: { yakuButton: true, progress: false, hint: false, labels: false, recommend: false, coach: false } }
};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* よめなくても すすめる */ }
    return {};
}

const data = load();
data.display = { ...DISPLAY_DEFAULTS, ...(data.display || {}) };
data.rules = { ...DEFAULT_RULES, ...(data.rules || {}) };
data.record = data.record || {};          // { 'cpu1': {w,l,d}, ... , online: {w,l,d} }
data.lessons = data.lessons || {};        // { lessonId: true }
data.name = data.name || '';
data.lastLevel = data.lastLevel || 3;

export function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* むし */ }
}

export const store = data;

export function isFirstRun() { return !data.setupDone; }
export function finishSetup() { data.setupDone = true; save(); }

export function addRecord(key, result) {
    const r = data.record[key] || (data.record[key] = { w: 0, l: 0, d: 0 });
    r[result] += 1;
    save();
}

/** アニメの はやさ（ミリ秒に かける 数） */
export function speedFactor() {
    return { slow: 1.5, normal: 1, fast: 0.55 }[data.display.speed] || 1;
}
