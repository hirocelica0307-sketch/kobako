/* くじびき ひろば ── しゅるいと 本数の 表（おみくじ・ガチャで つかう）
   items = [{label, n, lv}]。lv は 演出の つよさ（super / win / normal / lose）。
   本数を きめる ときは n が 本数、かぎりなし の ときは n が 出やすさ（わりあい）。 */
(function (root) {
    'use strict';
    const { $, esc } = root.Kuji;
    const L = root.KujiLogic;

    const LV = [['super', '大あたり'], ['win', 'あたり'], ['normal', 'ふつう'], ['lose', 'はずれ']];

    /** el の 中に 表を つくる。get() で いまの items */
    function table(el, opts) {
        opts = opts || {};
        let items = [];
        const body = $('.pz-rows', el);
        const mode = () => (opts.mode ? opts.mode() : 'stock');
        function render() {
            const pc = L.percents(items);
            body.innerHTML = items.map((it, i) => `
                <div class="pz-row" data-i="${i}">
                  <input class="pz-label" value="${esc(it.label)}" maxlength="20" aria-label="なまえ">
                  <span class="pz-num"><button type="button" class="btn ghost sm" data-d="-1" aria-label="へらす"><span class="ic" data-ic="minus"></span></button><input type="number" min="0" max="999" value="${it.n}" aria-label="本数"><button type="button" class="btn ghost sm" data-d="1" aria-label="ふやす"><span class="ic" data-ic="plus"></span></button></span>
                  <span class="pz-pc">${mode() === 'inf' ? pc[i] + '%' : it.n + (opts.unit || '本')}</span>
                  <select aria-label="演出">${LV.map(([v, t]) => `<option value="${v}"${v === it.lv ? ' selected' : ''}>${t}</option>`).join('')}</select>
                  <button type="button" class="btn ghost sm" data-del aria-label="けす"><span class="ic" data-ic="trash"></span></button>
                </div>`).join('');
            root.KujiIcons.fill(body);
            const tot = L.stockTotal(items);
            $('.pz-total', el).textContent = mode() === 'inf' ? `出やすさの 合計 ${tot}` : `ぜんぶで ${tot}${opts.unit || '本'}`;
        }
        function read() {
            items = Array.from(body.querySelectorAll('.pz-row')).map(r => ({
                label: $('.pz-label', r).value.trim() || '？',
                n: L.clamp(Math.round($('input[type=number]', r).value), 0, 999),
                lv: $('select', r).value,
            }));
        }
        body.addEventListener('input', e => {
            read();
            if (e.target.type === 'number') updPc();
            if (e.target.classList.contains('pz-label')) {
                // ことばから 演出を おすすめ
                const r = e.target.closest('.pz-row');
                $('select', r).value = L.levelOfLabel(e.target.value, $('select', r).value);
                read();
            }
        });
        body.addEventListener('change', read);
        body.addEventListener('click', e => {
            const r = e.target.closest('.pz-row');
            if (!r) return;
            const i = Number(r.dataset.i);
            const d = e.target.closest('[data-d]');
            if (d) { read(); items[i].n = L.clamp(items[i].n + Number(d.dataset.d), 0, 999); render(); }
            if (e.target.closest('[data-del]')) { read(); if (items.length > 1) { items.splice(i, 1); render(); } }
        });
        $('[data-add]', el).addEventListener('click', () => { read(); if (items.length < 12) { items.push({ label: 'あたらしい', n: 1, lv: 'normal' }); render(); } });
        function updPc() {
            const pc = L.percents(items);
            body.querySelectorAll('.pz-row').forEach((r, i) => { $('.pz-pc', r).textContent = mode() === 'inf' ? pc[i] + '%' : items[i].n + (opts.unit || '本'); });
            const tot = L.stockTotal(items);
            $('.pz-total', el).textContent = mode() === 'inf' ? `出やすさの 合計 ${tot}` : `ぜんぶで ${tot}${opts.unit || '本'}`;
        }
        return {
            set(v) { items = v.map(x => Object.assign({}, x)); render(); },
            get() { read(); return items.map(x => Object.assign({}, x)); },
            refresh() { read(); render(); },
        };
    }

    root.KujiPrizes = { table, LV };
})(window);
