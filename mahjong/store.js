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
    sortHand: true        // 手牌を ならべる
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
data.rules = { ...DEFAULT_RULES, ...(data.rules || {}) };
data.record = data.record || {};       // { 'lv1': { games, ranks:[1位,2位,3位,4位] }, online: {...} }
data.name = data.name || '';
data.level = data.level || 2;

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
