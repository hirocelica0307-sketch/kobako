/* 速読ラボ ── 画面を使わない処理
   文字数の数え方・文節の区切り・青空文庫テキストの整形・読む速さの計算・ペースの調整をまとめます。
   tests.js がこのファイルだけを読みこんで確かめます（ブラウザでも node でも動く）。

   本文の持ち方：ふつうの文字列。ルビは青空文庫と同じ「｜親文字《よみ》」で持つ
   （｜の無い「漢字《よみ》」も読める）。段落は改行で分ける。 */
(function (root) {
    'use strict';

    /* ---------- 文字の種類 ---------- */
    const RE_KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ〇\u{20000}-\u{2ffff}]/u;
    const RE_HIRA = /[ぁ-ゟ]/;
    const RE_KATA = /[゠-ヿㇰ-ㇿｦ-ﾟー]/;
    const RE_ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/;
    const CLOSE = '、。，．,.！？!?」』）)】〕〉》］]…‥―—・：:；;ゝゞヽヾ〜～';
    const OPEN = '「『（(【〔〈《［[';

    /** 1文字の種類：K 漢字・H ひらがな・T カタカナ・A 英数・C 閉じ（句読点など）・O 開き・S 空白・X その他 */
    function charClass(ch) {
        if (!ch) return 'X';
        if (/\s|　/.test(ch)) return 'S';
        if (CLOSE.includes(ch)) return 'C';
        if (OPEN.includes(ch)) return 'O';
        if (RE_KANJI.test(ch)) return 'K';
        if (RE_HIRA.test(ch)) return 'H';
        if (RE_KATA.test(ch)) return 'T';
        if (RE_ALNUM.test(ch)) return 'A';
        return 'X';
    }

    /* ---------- ルビの読みとり ---------- */
    /** 1行を「単位」の列にする。単位 = { t: 文字列, r: よみ(ルビがあるときだけ) }。
        ルビつきの親文字はまとめて1単位、それ以外は1文字1単位。 */
    function parseInline(line) {
        const out = [];
        const chars = Array.from(line);
        let i = 0;
        while (i < chars.length) {
            const ch = chars[i];
            if (ch === '｜') {
                const close = chars.indexOf('《', i + 1);
                const end = close < 0 ? -1 : chars.indexOf('》', close + 1);
                if (close > i + 1 && end > close) {
                    out.push({ t: chars.slice(i + 1, close).join(''), r: chars.slice(close + 1, end).join('') });
                    i = end + 1;
                    continue;
                }
                i++; // ｜だけ残っていたら捨てる
                continue;
            }
            if (ch === '《') {
                const end = chars.indexOf('》', i + 1);
                if (end > i) {
                    const reading = chars.slice(i + 1, end).join('');
                    // ｜の無いルビ：直前に続いている漢字（無ければ同じ種類の文字）を親文字にする
                    let k = out.length;
                    const cls = k ? charClass(out[k - 1].t) : 'X';
                    while (k > 0 && !out[k - 1].r && Array.from(out[k - 1].t).length === 1 && charClass(out[k - 1].t) === cls && cls !== 'S' && cls !== 'C' && cls !== 'O') k--;
                    if (k < out.length) {
                        const base = out.splice(k).map(u => u.t).join('');
                        out.push({ t: base, r: reading });
                    }
                    i = end + 1;
                    continue;
                }
            }
            out.push({ t: ch });
            i++;
        }
        return out;
    }

    /** ルビを外したふつうの文字列 */
    function plainText(text) {
        return String(text).split('\n').map(l => parseInline(l).map(u => u.t).join('')).join('\n');
    }

    /** 文字数：空白・改行とルビのよみは数えない（句読点やかぎかっこは数える） */
    function countChars(text) {
        let n = 0;
        for (const ch of plainText(text)) if (charClass(ch) !== 'S') n++;
        return n;
    }

    /* ---------- 文節の区切り ---------- */
    const unitClass = u => (u.r ? 'K' : charClass(Array.from(u.t)[0]));
    const unitLen = u => Array.from(u.t).filter(c => charClass(c) !== 'S').length;
    const PARTICLE_END = 'はがをにでともへのてばや';

    /** 長すぎるまとまりを、ことばの切れ目（Intl.Segmenter があれば）で分ける */
    function splitLong(chunk, maxLen) {
        const len = chunk.reduce((s, u) => s + unitLen(u), 0);
        if (len <= maxLen) return [chunk];
        const Seg = typeof Intl !== 'undefined' && Intl.Segmenter;
        let cuts = [];
        if (Seg) {
            // 単位の切れ目のうち、ことばの切れ目でもある所を候補にする
            const text = chunk.map(u => u.t).join('');
            const wordEnds = new Set();
            for (const s of new Seg('ja', { granularity: 'word' }).segment(text)) wordEnds.add(s.index + s.segment.length);
            let pos = 0;
            chunk.forEach((u, i) => { pos += u.t.length; if (wordEnds.has(pos) && i < chunk.length - 1) cuts.push(i + 1); });
        } else {
            cuts = chunk.map((_, i) => i + 1).slice(0, -1);
        }
        const parts = [];
        let start = 0, acc = 0, best = -1;
        for (let i = 0; i < chunk.length; i++) {
            acc += unitLen(chunk[i]);
            const canCut = cuts.includes(i + 1);
            if (canCut && PARTICLE_END.includes(chunk[i].t)) best = i + 1;
            if (acc >= maxLen && i < chunk.length - 1) {
                let at = best > start ? best : (canCut ? i + 1 : -1);
                if (at < 0) continue;
                parts.push(chunk.slice(start, at));
                acc = chunk.slice(at, i + 1).reduce((s, u) => s + unitLen(u), 0);
                start = at; best = -1;
            }
        }
        parts.push(chunk.slice(start));
        return parts.filter(p => p.length);
    }

    /** 1段落（1行）を文節くらいのまとまりに分ける。返り値は単位の配列の配列。
        きまり：ひらがなの後に漢字・カタカナ・英数・開きかっこが来たら区切る。句読点・閉じかっこは前につける。 */
    function chunkLine(line, maxLen) {
        const units = typeof line === 'string' ? parseInline(line) : line;
        maxLen = maxLen || 12;
        const chunks = [];
        let cur = [];
        let prev = null; // 直前の単位の種類
        for (const u of units) {
            const c = unitClass(u);
            let cut = false;
            if (cur.length) {
                if (prev === 'C' && c !== 'C') cut = true;
                else if (c === 'O' && prev !== 'O') cut = true;
                else if (prev === 'H' && (c === 'K' || c === 'T' || c === 'A' || c === 'X')) cut = true;
                else if (prev === 'S' && c !== 'S') cut = true;
            }
            if (cut) { chunks.push(cur); cur = []; }
            cur.push(u);
            prev = c;
        }
        if (cur.length) chunks.push(cur);
        // 空白だけのまとまりは前（無ければ後ろ）にくっつける
        const merged = [];
        for (const ch of chunks) {
            const blank = ch.every(u => unitClass(u) === 'S');
            if (blank && merged.length) merged[merged.length - 1].push(...ch);
            else merged.push(ch);
        }
        if (merged.length > 1 && merged[0].every(u => unitClass(u) === 'S')) merged.splice(0, 2, merged[0].concat(merged[1]));
        return merged.flatMap(ch => splitLong(ch, maxLen));
    }

    /** 本文全体を段落ごとのまとまりにする：[{ chunks: [{ units, len }] }]（空行は blank: true） */
    function layout(text, maxLen) {
        return String(text).split('\n').map(line => {
            if (!line.trim()) return { blank: true, chunks: [] };
            return { chunks: chunkLine(line, maxLen).map(units => ({ units, len: units.reduce((s, u) => s + unitLen(u), 0) })) };
        });
    }

    /* ---------- 青空文庫のテキスト ---------- */
    /** 外字の注記「※［＃…］」を、U+ の番号があればその字に、無ければ〓にする */
    function gaiji(note) {
        const m = note.match(/U\+([0-9A-Fa-f]{4,6})/);
        if (m) return String.fromCodePoint(parseInt(m[1], 16));
        return '〓';
    }

    /** 青空文庫の「ルビつき」テキスト（.txt の中身）を整える。
        返り値 { title, author, body, credit }：
        body は「｜親文字《よみ》」の形でルビを残し、注記や記号の説明を除いたもの。
        credit は末尾の「底本：」からの情報（入力者・校正者など）。そのまま保存して見られるようにする。 */
    function cleanAozora(raw) {
        let s = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
        const lines = s.split('\n');
        // 配布ファイルの形：題名・著者の行 →「-----」で囲まれた記号の説明 → 本文 → 底本
        let bodyStart = 0, title = '', author = '', translator = '';
        const dash = lines.findIndex(l => /^-{10,}/.test(l));
        if (dash >= 0 && dash < 60 && /【テキスト中に現れる記号について】/.test(lines.slice(dash, dash + 3).join(''))) {
            const dash2 = lines.findIndex((l, k) => k > dash && /^-{10,}/.test(l));
            bodyStart = dash2 > 0 ? dash2 + 1 : dash + 1;
            const before = lines.slice(0, dash).map(l => l.trim()).filter(Boolean);
            // いちばん下の行が著者。「〜訳」の行があれば訳者で、その上が著者。残りが題名と副題
            if (before.length >= 3 && /訳$/.test(before[before.length - 1])) translator = before.pop();
            title = before.length >= 2 ? before.slice(0, -1).filter(l => !/^[\x20-\x7e]+$/.test(l)).join(' ') : (before[0] || '');
            author = before.length >= 2 ? before[before.length - 1].replace(/[　 ]+[\x20-\x7e]+$/, '') : '';
        }
        let bodyLines = lines.slice(bodyStart);
        // 末尾の「底本：」から後ろを credit に分ける
        const sokoIdx = bodyLines.findIndex(l => /^底本[：:]/.test(l.trim()));
        let credit = '';
        if (sokoIdx >= 0) {
            credit = bodyLines.slice(sokoIdx).join('\n').trim();
            bodyLines = bodyLines.slice(0, sokoIdx);
        }
        let body = bodyLines.join('\n');
        body = body
            .replace(/※［＃[^］]*］/g, gaiji)
            .replace(/［＃改(ページ|丁|段|見開き)］/g, '\n')
            .replace(/［＃[^］]*］/g, '')
            .replace(/／″＼/g, '〲').replace(/／＼/g, '〱')
            .replace(/〔([^〕]*)〕/g, '$1');
        // ｜の無いルビにも｜をつけて形をそろえる
        body = body.split('\n').map(line => {
            const units = parseInline(line);
            return units.map(u => (u.r ? '｜' + u.t + '《' + u.r + '》' : u.t)).join('').replace(/[ \t]+$/, '');
        }).join('\n');
        body = body.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
        return { title: plainText(title), author: plainText(author), translator: plainText(translator), body, credit };
    }

    /** 文字列が青空文庫のテキストらしいか（ルビ記号・注記・底本のどれかがある） */
    function looksAozora(s) {
        return /《[^》\n]+》|［＃|^底本[：:]|【テキスト中に現れる記号について】/m.test(String(s));
    }

    /** 長い本文を、段落の切れ目で target 文字くらいずつの区間に分ける。返り値：本文の配列 */
    function splitSections(body, target) {
        target = target || 2000;
        const paras = String(body).split('\n');
        const out = [];
        let cur = [], n = 0;
        for (const p of paras) {
            cur.push(p);
            n += countChars(p);
            if (n >= target) { out.push(cur.join('\n').replace(/^\n+|\n+$/g, '')); cur = []; n = 0; }
        }
        const rest = cur.join('\n').replace(/^\n+|\n+$/g, '');
        if (rest) {
            // 残りが短すぎるときは前の区間にまぜる
            if (out.length && countChars(rest) < target * 0.3) out[out.length - 1] += '\n' + rest;
            else out.push(rest);
        }
        return out.filter(x => x.trim());
    }

    /* ---------- 入っている文章のファイル（texts/*.txt） ---------- */
    /* 形：
         title: 題名          ← 「名前: 値」の行が続く（title・author・translator・kind・genre・style・level・mode・source）
         @@本文
         （区間1の本文）
         @@区切り
         （区間2の本文）
         @@問題
         [1]                  ← 区間の番号（1から）
         Q main 問題文         ← main（要点）・detail（くわしく）・infer（読みとり）
         + 正解
         - まちがい（3つ）
         @@底本
         （青空文庫の底本・入力者などの情報） */
    const QTYPES = ['main', 'detail', 'infer'];

    /** texts/*.txt を読みとる。返り値 { meta, sections: [本文], questions: [[問題]], credit } */
    function parseTextFile(src) {
        const lines = String(src).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
        const meta = {};
        const body = [];
        const questions = [];
        const credit = [];
        let part = 'head', sec = -1, q = null;
        for (const line of lines) {
            if (/^@@本文\s*$/.test(line)) { part = 'body'; body.push([]); continue; }
            if (/^@@区切り\s*$/.test(line)) { body.push([]); continue; }
            if (/^@@問題\s*$/.test(line)) { part = 'q'; continue; }
            if (/^@@底本\s*$/.test(line)) { part = 'credit'; continue; }
            if (part === 'head') {
                const m = line.match(/^([a-z]+):\s*(.*)$/);
                if (m) meta[m[1]] = m[2].trim();
            } else if (part === 'body') {
                body[body.length - 1].push(line);
            } else if (part === 'q') {
                let m;
                if ((m = line.match(/^\[(\d+)\]\s*$/))) { sec = +m[1] - 1; questions[sec] = questions[sec] || []; q = null; }
                else if ((m = line.match(/^Q\s+(main|detail|infer)\s+(.+)$/))) {
                    q = { type: m[1], q: m[2].trim(), choices: [], answer: -1 };
                    (questions[sec] = questions[sec] || []).push(q);
                } else if ((m = line.match(/^([+-])\s+(.+)$/)) && q) {
                    if (m[1] === '+') q.answer = q.choices.length;
                    q.choices.push(m[2].trim());
                }
            } else if (part === 'credit') {
                credit.push(line);
            }
        }
        if (meta.level) meta.level = +meta.level;
        const sections = body.map(b => b.join('\n').replace(/^\n+|\n+$/g, ''));
        for (let i = 0; i < sections.length; i++) questions[i] = questions[i] || [];
        return { meta, sections, questions: questions.slice(0, sections.length), credit: credit.join('\n').trim() };
    }

    /** 文章ファイルの形がおかしいところを返す（空なら正しい） */
    function checkTextFile(t) {
        const bad = [];
        if (!t.meta.title) bad.push('title が無い');
        if (!t.sections.length || t.sections.some(s => !s.trim())) bad.push('空の区間がある');
        if (!['check', 'pace', 'repeat', 'skim', 'long'].includes(t.meta.mode)) bad.push('mode がおかしい');
        if (t.meta.mode !== 'long') {
            t.questions.forEach((qs, i) => {
                if (qs.length < 3) bad.push(`区間${i + 1} の問題が3問より少ない`);
                if (!qs.some(q => q.type === 'main')) bad.push(`区間${i + 1} に要点の問題が無い`);
                qs.forEach((q, k) => {
                    if (q.choices.length !== 4) bad.push(`区間${i + 1} 問${k + 1} の選択肢が4つでない`);
                    if (q.answer < 0) bad.push(`区間${i + 1} 問${k + 1} に正解（+）が無い`);
                    if (new Set(q.choices).size !== q.choices.length) bad.push(`区間${i + 1} 問${k + 1} に同じ選択肢`);
                });
            });
        }
        return bad;
    }

    /* ---------- zip（青空文庫の配布ファイル） ---------- */
    /** zip の中の .txt を1つ取り出す（バイト列を返す）。inflate は (Uint8Array)=>Promise<Uint8Array> */
    async function unzipFirstText(buf, inflate) {
        const b = new Uint8Array(buf);
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        // 中央ディレクトリの終わり（EOCD）を後ろから探す
        let eocd = -1;
        for (let p = b.length - 22; p >= Math.max(0, b.length - 65557); p--) {
            if (dv.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
        }
        if (eocd < 0) throw new Error('zip ファイルとして読めませんでした');
        const count = dv.getUint16(eocd + 10, true);
        let p = dv.getUint32(eocd + 16, true);
        const entries = [];
        for (let k = 0; k < count; k++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true);
            const csize = dv.getUint32(p + 20, true);
            const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
            const local = dv.getUint32(p + 42, true);
            const name = new TextDecoder('latin1').decode(b.subarray(p + 46, p + 46 + nlen));
            entries.push({ name, method, csize, local });
            p += 46 + nlen + xlen + clen;
        }
        const e = entries.find(x => /\.txt$/i.test(x.name));
        if (!e) throw new Error('zip の中に .txt が見つかりませんでした');
        const lnlen = dv.getUint16(e.local + 26, true), lxlen = dv.getUint16(e.local + 28, true);
        const data = b.subarray(e.local + 30 + lnlen + lxlen, e.local + 30 + lnlen + lxlen + e.csize);
        if (e.method === 0) return data;
        if (e.method === 8) return inflate(data);
        throw new Error('この zip の圧縮形式には対応していません');
    }

    /** バイト列を文字列に：UTF-8 として正しければ UTF-8、ちがえば Shift_JIS（青空文庫のふつうの形） */
    function decodeText(bytes) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch (e) { return new TextDecoder('shift_jis').decode(bytes); }
    }

    /* ---------- 速さと理解度 ---------- */
    /** 1分あたりの文字数（字/分）。整数に丸める */
    function cpm(chars, ms) {
        if (!(ms > 0)) return 0;
        return Math.round(chars / (ms / 60000));
    }

    /** 理解して読めた速さ（実効速度）＝ 速さ × 理解度 */
    function effective(speed, comp) {
        if (comp == null) return null;
        return Math.round(speed * comp / 100);
    }

    /** 確認問題の正答率（%） */
    function score(answers, questions) {
        if (!questions.length) return 0;
        let ok = 0;
        questions.forEach((q, i) => { if (answers[i] === q.answer) ok++; });
        return Math.round(ok / questions.length * 100);
    }

    /** 自分でつけた手ごたえ（1〜5）を理解度（%）のめやすにする */
    function selfComp(rating) {
        return ({ 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 })[rating] ?? null;
    }

    const PACE_MIN = 150, PACE_MAX = 3000;
    const clampPace = v => Math.max(PACE_MIN, Math.min(PACE_MAX, Math.round(v / 10) * 10));

    /** ペースガイドのあとの次のペース：理解度 80% 以上なら 5% 上げる・60% 未満なら 10% 下げる・その間はそのまま */
    function nextPace(pace, comp) {
        if (comp == null) return pace;
        if (comp >= 80) return clampPace(pace * 1.05);
        if (comp < 60) return clampPace(pace * 0.9);
        return clampPace(pace);
    }

    /** はじめのペース：ふだんの速さの 1.1 倍（少しだけ速く） */
    function startPace(baseline) {
        return clampPace((baseline || 450) * 1.1);
    }

    /** 要点読みの制限時間（ms）：ふだんの速さで読む時間の 40%。最短 15 秒 */
    function skimLimitMs(chars, baseline) {
        const base = baseline || 450;
        return Math.max(15000, Math.round(chars / base * 60000 * 0.4));
    }

    /** ペースガイドの時間割：各まとまりが始まる時刻（ms）。最後の要素は全体の時間 */
    function schedule(lengths, pace) {
        const per = 60000 / pace;
        const t = [0];
        for (const n of lengths) t.push(t[t.length - 1] + Math.max(1, n) * per);
        return t;
    }

    /** 時刻 ms のときに読んでいるまとまりの番号（二分探索） */
    function indexAt(times, ms) {
        let lo = 0, hi = times.length - 2;
        if (ms <= 0) return 0;
        if (ms >= times[times.length - 1]) return times.length - 1; // 読み終わり
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (times[mid] <= ms) lo = mid; else hi = mid - 1;
        }
        return lo;
    }

    /* ---------- 記録のまとめ ---------- */
    /** ふだんの速さ：「速さチェック」と「くり返し読みの1回め」の新しい方から5回の中央値。
        読んだことのある文章（reread）と、色づけを使った回（guided）は入れない。それしか無いときだけ入れる */
    function baseline(records) {
        const all = records.filter(r => (r.mode === 'check' || r.mode === 'repeat') && r.cpm > 0);
        const clean = all.filter(r => !r.reread && !r.guided);
        const xs = (clean.length ? clean : all).slice(-5).map(r => (r.mode === 'repeat' && r.rounds ? r.rounds[0] : r.cpm));
        if (!xs.length) return null;
        const s = xs.slice().sort((a, b) => a - b);
        const m = s.length >> 1;
        return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    }

    /** n 個の中から並びを入れかえる（rng は 0〜1 を返す関数） */
    function shuffle(arr, rng) {
        rng = rng || Math.random;
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** 問題の選択肢を並べかえる（answer の番号もつけかえる） */
    function shuffleQuestion(q, rng) {
        const order = shuffle(q.choices.map((_, i) => i), rng);
        return Object.assign({}, q, { choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer) });
    }

    /** 24時間以内の日付の表し方：2026/10/16 21:05 */
    function fmtDate(ts) {
        const d = new Date(ts);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    /** 経過時間の表し方：1分05秒・42秒 */
    function fmtTime(ms) {
        const s = Math.max(0, Math.round(ms / 1000));
        return s >= 60 ? `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒` : `${s}秒`;
    }

    root.SokuLogic = {
        charClass, parseInline, plainText, countChars, chunkLine, layout,
        cleanAozora, looksAozora, splitSections, unzipFirstText, decodeText, parseTextFile, checkTextFile, QTYPES,
        cpm, effective, score, selfComp, nextPace, startPace, clampPace, skimLimitMs,
        schedule, indexAt, baseline, shuffle, shuffleQuestion, fmtDate, fmtTime,
        PACE_MIN, PACE_MAX,
    };
})(typeof window !== 'undefined' ? window : globalThis);
