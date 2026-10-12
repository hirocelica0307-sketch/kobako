/* 設定と きろく（この 端末の localStorage に のこします）
   ------------------------------------------------------------------ */
import { DEFAULT_RULES } from './engine.js';

const KEY = 'raimei-mahjong.v1';

export const SETTINGS_DEFAULTS = {
    sound: true,          // 効果音
    voice: true,          // ポン・ロン などの こえ
    yakuVoice: true,      // あがりの とき 役の 名まえを 読みあげる
    fx: 'full',           // 演出：'full'（はでに）/ 'lite'（ひかえめ）
    speed: 'normal',      // slow / normal / fast
    showWaits: true,      // テンパイの とき 待ちを 出す
    hint: false,          // おすすめの 牌に しるし
    handMode: 'auto',     // 手牌：'auto'（自動で ならべる）/ 'manual'（自分で ドラッグして ならべる）
    riverStyle: 'natural',// 捨て牌：'natural'（手で 置いたように 少し ずれる）/ 'neat'（きっちり）
    showPoints: true,     // テンパイの とき あがりの 点数を 出す
    vibe: true            // 自分の 番・鳴ける とき バイブ
};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* よめなくても すすめる */ }
    return {};
}

const data = load();
data.settings = { ...SETTINGS_DEFAULTS, ...(data.settings || {}) };
if (data.settings.sortHand === false && !data.settings.handModeSet) data.settings.handMode = 'manual';   // まえの 設定から
delete data.settings.sortHand;
data.keisan = data.keisan || { done: 0, ok: 0 };   // 点数計算の 練習の きろく
data.rules = { ...DEFAULT_RULES, ...(data.rules || {}) };
data.record = data.record || {};       // { 'lv1': { games, ranks:[1位,2位,3位,4位] }, online: {...} }
data.name = data.name || '';
data.level = data.level || 2;
data.char = data.char || 'shiba';   // 自分の キャラクター（chars.js）

export function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* むし */ }
}

export const store = data;

export function addRecord(key, rank) {
    const r = data.record[key] || (data.record[key] = { games: 0, ranks: [0, 0, 0, 0] });
    r.games++;
    r.ranks[rank - 1]++;
    save();
}

/** アニメの はやさ（ミリ秒に かける 数） */
export function speedFactor() {
    return { slow: 1.4, normal: 1, fast: 0.6 }[data.settings.speed] || 1;
}
