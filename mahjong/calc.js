/* 点数計算の 説明（結果画面・練習・対局中の 予想で つかう）
   ------------------------------------------------------------------
   点数は「翻（はん）」と「符（ふ）」で きまります。
     基本点 = 符 × 2の(翻＋2)乗   （2000点を こえたら 満貫 2000）
     子の ロン ＝ 基本点×4、親の ロン ＝ 基本点×6（100点 未満は 切り上げ）
     ツモ：子が あがり → 親は 基本点×2、子は 基本点×1 ／ 親が あがり → 子 全員が 基本点×2
   ------------------------------------------------------------------ */
import { ceil100, tsumoPays } from './score.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n.toLocaleString();

/** 支払い（本場 なし）。sm：3人麻雀の とき { N: 3, tsumoLoss } */
export function payments(base, isDealer, tsumo, sm = null) {
    if (!tsumo) return { ron: ceil100(base * (isDealer ? 6 : 4)) };
    const tp = tsumoPays(base, isDealer, sm ? sm.N : 4, sm ? sm.tsumoLoss : true);
    if (isDealer) return { all: tp.ko };
    return { ko: tp.ko, oya: tp.oya };
}
const payers = sm => (sm && sm.N === 3 ? 2 : 3);

/** 点数の 言いかた（3900／1300・2600／2600オール） */
export function pointsLabel(base, isDealer, tsumo, sm = null) {
    const p = payments(base, isDealer, tsumo, sm);
    if (p.ron !== undefined) return fmt(p.ron);
    if (p.all !== undefined) return `${fmt(p.all)}オール`;
    return `${fmt(p.ko)}・${fmt(p.oya)}`;
}

/** あがった 人が もらう 合計（本場・供託 なし） */
export function totalOf(base, isDealer, tsumo, sm = null) {
    const p = payments(base, isDealer, tsumo, sm);
    if (p.ron !== undefined) return p.ron;
    if (p.all !== undefined) return p.all * payers(sm);
    return p.ko * (payers(sm) - 1) + p.oya;
}

/** 基本点の 説明 */
export function baseExplain(han, fu, yakuman, base) {
    if (yakuman) return `役満${yakuman > 1 ? `（${yakuman}倍）` : ''}は 基本点 ${fmt(8000 * yakuman)}点`;
    if (han >= 13) return base >= 8000 ? `13翻 以上は 数え役満：基本点 8000点` : `11翻 以上は 三倍満：基本点 6000点`;
    if (han >= 11) return `11〜12翻は 三倍満：基本点 6000点`;
    if (han >= 8) return `8〜10翻は 倍満：基本点 4000点`;
    if (han >= 6) return `6〜7翻は 跳満：基本点 3000点`;
    if (han >= 5) return `5翻は 満貫：基本点 2000点`;
    const raw = fu * Math.pow(2, han + 2);
    if (base === 2000 && raw < 2000) return `${fu}符 ${han}翻 は 切り上げ満貫：基本点 2000点`;
    if (raw >= 2000) return `${fu}符 × 2<sup>${han + 2}</sup> = ${fmt(raw)} → 2000点を こえるので 満貫：基本点 2000点`;
    return `${fu}符 × 2<sup>${han + 2}</sup>（${han}翻＋2） = ${fu} × ${Math.pow(2, han + 2)} = <b>${fmt(raw)}点</b>`;
}

/** 支払いの 説明 */
export function payExplain(base, isDealer, tsumo, sm = null) {
    const p = payments(base, isDealer, tsumo, sm);
    if (tsumo && sm && sm.N === 3) {
        const note = sm.tsumoLoss ? '（3人麻雀の ツモ損：いない 北家の ぶんは もらえない）' : '（3人麻雀：いない 北家の ぶんを 2人で 折半して 足す）';
        if (isDealer) return `親の ツモ：子 2人が それぞれ 基本点 × 2 = ${fmt(base * 2)} → <b>${fmt(p.all)}点 オール</b>（合計 ${fmt(p.all * 2)}点）${note}`;
        return `子の ツモ：親は <b>${fmt(p.oya)}</b>、子は <b>${fmt(p.ko)}</b>（基本点 × 2 と × 1。${fmt(p.ko)}・${fmt(p.oya)}、合計 ${fmt(p.ko + p.oya)}点）${note}`;
    }
    if (!tsumo) {
        const m = isDealer ? 6 : 4;
        return `${isDealer ? '親' : '子'}の ロン：基本点 × ${m} = ${fmt(base * m)} → 100点 未満を 切り上げて <b>${fmt(p.ron)}点</b>（ふりこんだ 人が はらう）`;
    }
    if (isDealer) return `親の ツモ：子 3人が それぞれ 基本点 × 2 = ${fmt(base * 2)} → 切り上げ <b>${fmt(p.all)}点 オール</b>（合計 ${fmt(p.all * 3)}点）`;
    return `子の ツモ：親は 基本点 × 2 = ${fmt(base * 2)} → <b>${fmt(p.oya)}</b>、子は 基本点 × 1 = ${fmt(base)} → <b>${fmt(p.ko)}</b>（${fmt(p.ko)}・${fmt(p.oya)}、合計 ${fmt(p.ko * 2 + p.oya)}点）`;
}

/**
 * 結果の 計算の しかたを HTML で
 * r：evaluateWin の 結果、opt：{ isDealer, tsumo, honba, sticks }
 */
export function explainHTML(r, { isDealer, tsumo, honba = 0, sticks = 0, sm = null }) {
    const rows = [];
    // 1. 翻
    const yakuRows = r.yaku.map(y => `<tr><td>${esc(y.name)}</td><td>${y.yakuman ? (y.yakuman > 1 ? 'ダブル役満' : '役満') : y.han + '翻'}</td></tr>`).join('');
    const doraRows = [['ドラ', r.dora], ['赤ドラ', r.aka], ['裏ドラ', r.ura], ['抜きドラ（北）', r.kita || 0]].filter(([, n]) => n > 0).map(([n, v]) => `<tr><td>${n}</td><td>${v}翻</td></tr>`).join('');
    rows.push(`<div class="cx-step"><h4>① 翻を かぞえる（役 ＋ ドラ）</h4><table class="cx-t">${yakuRows}${doraRows}<tr class="sum"><td>合計</td><td>${r.yakuman ? '役満' : r.han + '翻'}</td></tr></table></div>`);
    // 2. 符
    if (!r.yakuman) {
        if (r.han >= 5) {
            rows.push(`<div class="cx-step"><h4>② 符を かぞえる</h4><p>5翻 以上（満貫 以上）は 符に 関係なく きまるので、符は かぞえなくて よい（この 手は ${r.fu}符）。</p></div>`);
        } else if (r.fuParts) {
            const fr = r.fuParts.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v}符</td></tr>`).join('');
            const rawRow = r.fuParts.length > 1 && r.fuParts.raw ? `<tr class="sum"><td>合計</td><td>${r.fuParts.raw}符</td></tr>` : '';
            const round = r.fuParts.round ? `<p class="cx-note">${esc(r.fuParts.round)}</p>` : '';
            rows.push(`<div class="cx-step"><h4>② 符を かぞえる</h4><table class="cx-t">${fr}${rawRow}</table>${round}<p class="cx-res">→ <b>${r.fu}符</b></p></div>`);
        }
    }
    // 3. 基本点
    rows.push(`<div class="cx-step"><h4>③ 基本点</h4><p>${baseExplain(r.han, r.fu, r.yakuman, r.base)}</p></div>`);
    // 4. 支払い
    let pay = payExplain(r.base, isDealer, tsumo, sm);
    if (honba) pay += `<br>${honba}本場：${tsumo ? `1人 ＋${honba * 100}点` : `＋${honba * (sm && sm.N === 3 ? 200 : 300)}点`}`;
    if (sticks) pay += `<br>供託（リーチ棒）${sticks}本：＋${fmt(sticks * 1000)}点`;
    rows.push(`<div class="cx-step"><h4>④ はらう 点数</h4><p>${pay}</p></div>`);
    return `<div class="calcx">${rows.join('')}</div>`;
}

/** 早見表（子・親 × ロン・ツモ） */
export function quickTableHTML(isDealer) {
    const fus = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    const head = `<tr><th></th>${[1, 2, 3, 4].map(h => `<th>${h}翻</th>`).join('')}</tr>`;
    const body = fus.map(fu => {
        const cells = [1, 2, 3, 4].map(han => {
            if (fu === 20 && han === 1) return '<td class="na">―</td>';
            if (fu === 25 && han === 1) return '<td class="na">―</td>';
            let base = fu * Math.pow(2, han + 2);
            if (base >= 2000) return '<td class="mg">満貫</td>';
            const ron = fu === 20 ? '―' : fmt(ceil100(base * (isDealer ? 6 : 4)));
            const tsumo = fu === 25 && han < 3 ? '―' : (isDealer ? `${fmt(ceil100(base * 2))}∀` : `${fmt(ceil100(base))}・${fmt(ceil100(base * 2))}`);
            return `<td><b>${ron}</b><small>${tsumo}</small></td>`;
        }).join('');
        return `<tr><th>${fu}符</th>${cells}</tr>`;
    }).join('');
    const big = [['満貫', '5翻', 2000], ['跳満', '6〜7翻', 3000], ['倍満', '8〜10翻', 4000], ['三倍満', '11〜12翻', 6000], ['役満', '13翻〜', 8000]]
        .map(([n, h, b]) => `<tr><th>${n}<small>${h}</small></th><td><b>${fmt(b * (isDealer ? 6 : 4))}</b><small>${isDealer ? `${fmt(b * 2)}∀` : `${fmt(b)}・${fmt(b * 2)}`}</small></td></tr>`).join('');
    return `<table class="qt">${head}${body}</table><p class="qt-note">上の 数字は ロン、下は ツモ（${isDealer ? '∀＝オール' : '子・親'}）。20符は ツモ（平和ツモ）だけ、25符は 七対子。</p><table class="qt big">${big}</table>`;
}
