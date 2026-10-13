/* なかま：いま アプリを ひらいて いるか・さそう・さそわれた ときの 表示
   ------------------------------------------------------------------
   一度 合言葉の 部屋に いっしょに 入った 人どうしは 自動で「なかま」に なります（app.js）。
   なかまが アプリを ひらいて いると ホームの「なかま」に ●で 出て、「さそう」を おすと
   相手の 画面に「○○さんから 対戦に さそわれて います。対戦しますか？」が 出ます（どの 画面に いても）。
   「対戦する」で 合言葉を 入れなくても その 部屋に 入り、すぐに 対局が はじまります。
   アプリを とじて いる 人には とどきません（スマホの 通知には ならない）。
   ------------------------------------------------------------------ */
import * as net from './net.js';
import { store, save } from './store.js';
import { charImg } from './chars.js';
import { sfx } from './sound.js';
import { buzz } from './haptic.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INVITE_LIFE = 90 * 1000;      // さそいが 有効な 時間

const state = { started: new Set(), online: {}, handlers: {}, shown: new Set(), unsub: [], busy: false, sent: null };
const listeners = new Set();
const changed = () => listeners.forEach(f => { try { f(); } catch (e) { /* むし */ } });

export const friendList = () => Object.entries(store.friends || {}).map(([id, f]) => ({ id, ...f, on: state.online[id] || null })).sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0) || (b.t || 0) - (a.t || 0));
export const onFriendsChange = f => { listeners.add(f); return () => listeners.delete(f); };

/** app.js から：さそう ときに 部屋を つくる・さそいを うけた ときに 部屋に 入る */
export function setHandlers(h) { state.handlers = h; }

function me() { return { name: store.name || 'あなた', char: store.char, busy: state.busy, t: Date.now() }; }

/** なかまが いれば つないで 見はりを はじめる（何度 よんでも よい） */
export async function startFriends() {
    const ids = Object.keys(store.friends || {});
    const fresh = ids.filter(id => !state.started.has(id));
    if (!fresh.length) return;
    try {
        await net.announce(fresh, me);
        for (const id of fresh) {
            state.started.add(id);
            net.watchFriend(id, v => {
                // 30分 いじょう 前の しるしは のこりかすと みなす
                state.online[id] = v && Date.now() - (v.t || 0) < 30 * 60 * 1000 ? v : null;
                if (v && store.friends[id] && (v.name !== store.friends[id].name || v.char !== store.friends[id].char)) {
                    store.friends[id].name = v.name; store.friends[id].char = v.char; save();
                }
                changed();
            }).then(f => state.unsub.push(f));
            net.watchInvite(id, (inv, now) => onInvite(id, inv, now)).then(f => state.unsub.push(f));
        }
    } catch (e) { /* つうしん できない ときは なにも しない */ }
}

/** 同じ 部屋に 入った 人を なかまに する */
export function addFriend(fid, name, char) {
    if (!fid || fid === net.friendId()) return;
    const isNew = !store.friends[fid];
    store.friends[fid] = { name: name || 'ともだち', char: char || 'rabbit', t: Date.now() };
    save();
    if (isNew) startFriends();
    changed();
}

export function removeFriend(fid) {
    delete store.friends[fid]; save();
    changed();
}

/** 対局中・部屋に いる ときは「いそがしい」と しらせる */
export function setBusy(b) {
    if (state.busy === b) return;
    state.busy = b;
    const ids = [...state.started];
    if (ids.length) net.updateAnnounce(ids, me()).catch(() => {});
}

/* ── さそう ── */
export async function invite(fid) {
    const f = store.friends[fid];
    if (!f || !state.handlers.createRoom) return;
    const code = await state.handlers.createRoom();
    state.sent = { fid, code };
    await net.sendInvite(fid, { name: store.name || 'あなた', char: store.char, code });
}
export const sentInvite = () => state.sent;
export function cancelInvite() {
    if (state.sent) { net.answerInvite(state.sent.fid, 'cancel'); state.sent = null; }
}

/* ── さそわれた ── */
function onInvite(fid, inv, now) {
    const box = document.querySelector('.inv-pop');
    // 自分が おくった さそいの へんじ
    if (inv && inv.from === net.friendId()) {
        if (state.sent && state.sent.fid === fid && inv.code === state.sent.code && inv.st === 'no') {
            toast(`${esc(store.friends[fid] ? store.friends[fid].name : 'ともだち')}さんは いまは 対戦 できない みたいです`);
            state.sent = null;
        }
        return;
    }
    if (!inv || inv.st !== 'ask' || now - (inv.t || 0) > INVITE_LIFE) {
        if (box && box.dataset.fid === fid) box.remove();
        return;
    }
    const key = fid + ':' + inv.t;
    if (state.shown.has(key)) return;
    state.shown.add(key);
    if (state.busy) { net.answerInvite(fid, 'no'); return; }   // 友だちと 対局中は ことわる
    showPopup(fid, inv);
}

function showPopup(fid, inv) {
    document.querySelectorAll('.inv-pop').forEach(x => x.remove());
    const el = document.createElement('div');
    el.className = 'inv-pop';
    el.dataset.fid = fid;
    el.innerHTML = `<div class="inv-card" role="dialog" aria-live="assertive">
<img src="${charImg(inv.char)}" alt="">
<p><b>${esc(inv.name)}</b>さんから<br>対戦に さそわれて います！</p>
<p class="inv-q">対戦しますか？</p>
<div class="inv-btns"><button class="btn primary inv-yes">対戦する</button><button class="btn inv-no">あとで</button></div>
</div>`;
    document.body.appendChild(el);
    try { sfx.riichi(); } catch (e) { /* むし */ }
    buzz('call');
    const close = () => el.remove();
    el.querySelector('.inv-no').addEventListener('click', () => { sfx.button(); net.answerInvite(fid, 'no'); close(); });
    el.querySelector('.inv-yes').addEventListener('click', async () => {
        sfx.button();
        el.querySelector('.inv-q').textContent = 'つないで います…';
        el.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
            await net.answerInvite(fid, 'yes');
            await state.handlers.joinRoom(inv.code);
            close();
        } catch (e) {
            el.querySelector('.inv-q').textContent = e.message || '入れませんでした';
            setTimeout(close, 2500);
        }
    });
    // 時間ぎれで 消す
    setTimeout(() => { if (el.isConnected) close(); }, INVITE_LIFE);
}

export function toast(html) {
    const el = document.createElement('div');
    el.className = 'inv-toast';
    el.innerHTML = html;
    document.body.appendChild(el);
    el.addEventListener('click', () => el.remove());
    setTimeout(() => el.remove(), 4500);
}

/* ── ホームの「なかま」 ── */
export function friendsHTML() {
    const list = friendList();
    if (!list.length) {
        return `<div class="fr-box"><h3>なかま</h3><p class="note">「友だちと 対戦」で 一度 同じ 部屋に 入ると、その 人が ここに 出ます。つぎからは アプリを ひらいて いるか わかり、「さそう」だけで 対戦に よべます。</p></div>`;
    }
    return `<div class="fr-box"><h3>なかま</h3>${list.map(f => `<div class="fr-row${f.on ? ' on' : ''}">
<img src="${charImg(f.char)}" alt=""><div class="fr-txt"><b>${esc(f.name)}</b><small>${f.on ? (f.on.busy ? '<i class="dot busy"></i>対局中' : '<i class="dot"></i>いま ひらいて います') : 'いまは いません'}</small></div>
<button class="btn ${f.on && !f.on.busy ? 'primary' : ''} fr-inv" data-inv="${esc(f.id)}" ${f.on && !f.on.busy ? '' : 'disabled'}>さそう</button></div>`).join('')}
<p class="note">相手が アプリを ひらいて いる ときだけ さそえます（とじて いる ときは とどきません）。</p></div>`;
}

export function bindFriends(root, onError) {
    root.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', async () => {
        sfx.button();
        b.disabled = true;
        b.textContent = 'さそって います…';
        try { await invite(b.dataset.inv); } catch (e) { b.disabled = false; b.textContent = 'さそう'; if (onError) onError(e); }
    }));
}
