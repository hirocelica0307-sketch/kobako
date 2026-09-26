/* ブロック おはじき ── せんせい から こども へ くばる（Firebase）
   ------------------------------------------------------------------
   ・「かいて あてて」「タイピング つなひき」と おなじ Firebase プロジェクト
     （hiro-kobako）の Realtime Database を つかいます。
   ・くばる ときは 6けたの コードを つくって ohajiki/shares/{コード} に 1回だけ 書きます。
     書いた 人（匿名の ID）だけが 書きかえ・けす ことが できます（database.rules.json）。
   ・Firebase の 読みこみは あとまわし（dynamic import）。ネットが ない ときも 画面は うごきます。
   ・Firebase の 無料プランは「同時に つながる のは 100まで」。くばる・よみこむ が おわったら
     すぐ つなぎを きって（goOffline）、ページを ひらいた ままの 子が 1つ ぶんを つかい つづけない ように します。
     ずっと つないで おきたい とき（hold）は かずを かぞえて、だれも つかわなく なったら きります。
   ・ためす ときは window.__KUKU_FAKE_SHARE__（exists / put / get）を おくと、
     本物の かわりに それを つかいます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const CONFIG = {
        apiKey: 'AIzaSyBsf_UntQvkfRl0fZijHBYH7Ctm00OPLZY',
        authDomain: 'hiro-kobako.firebaseapp.com',
        databaseURL: 'https://hiro-kobako-default-rtdb.asia-southeast1.firebasedatabase.app',
        projectId: 'hiro-kobako',
        appId: '1:781860379018:web:745ea72a961a7575aa9073',
    };
    const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
    const PATH = 'ohajiki/shares/';
    const TIMEOUT = 20000;

    let connecting = null;

    function withTimeout(p, ms, msg) {
        return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
    }

    function connect() {
        if (!connecting) connecting = open().catch((e) => { connecting = null; throw e; });
        return connecting;
    }

    async function open() {
        if (root.__KUKU_FAKE_SHARE__) return { fake: root.__KUKU_FAKE_SHARE__ };
        if (location.protocol === 'file:') {
            throw new Error('ファイルとして ひらいて いる ときは コードで くばれません（ファイルで やりとり してください）');
        }
        let appMod, authMod, dbMod;
        try {
            [appMod, authMod, dbMod] = await Promise.all([
                import(SDK + 'firebase-app.js'),
                import(SDK + 'firebase-auth.js'),
                import(SDK + 'firebase-database.js'),
            ]);
        } catch (e) {
            throw new Error('つうしんの じゅんびが できませんでした（ネットに つながっているか かくにんしてください）');
        }
        const app = appMod.initializeApp(CONFIG, 'block-ohajiki');
        const auth = authMod.getAuth(app);
        await withTimeout(authMod.signInAnonymously(auth), TIMEOUT, 'サインインに 時間が かかりすぎました')
            .catch(() => { throw new Error('サインインが できませんでした'); });
        const db = dbMod.getDatabase(app);
        dbMod.goOffline(db);   /* つかう ときだけ つなぐ（using） */
        return { db, fb: dbMod, uid: auth.currentUser.uid };
    }

    function explain(e) {
        const m = String((e && (e.code || e.message)) || e);
        if (/permission/i.test(m)) return new Error('Firebase の ルールが まだ はられて いません（README の「Firebase の ルール」を みてください）');
        return e instanceof Error ? e : new Error(m);
    }

    const newCode = () => String(100000 + Math.floor(Math.random() * 900000));

    /* つないで いる りゆうの かず。0 に なったら きる */
    let holds = 0;
    function hold(c) {
        if (c.fake) return;
        if (holds++ === 0) c.fb.goOnline(c.db);
    }
    function release(c) {
        if (c.fake) return;
        if (--holds <= 0) { holds = 0; c.fb.goOffline(c.db); }
    }
    async function using(fn) {
        const c = await connect();
        hold(c);
        try { return await fn(c); } finally { release(c); }
    }

    /** data（文字）を くばって、6けたの コードを かえす */
    async function upload(data) {
        return using(async (c) => {
        try {
            for (let i = 0; i < 8; i++) {
                const code = newCode();
                if (c.fake) {
                    if (await c.fake.exists(code)) continue;
                    await c.fake.put(code, data);
                    return code;
                }
                const ref = c.fb.ref(c.db, PATH + code);
                const snap = await withTimeout(c.fb.get(ref), TIMEOUT, 'つうしんに 時間が かかりすぎました');
                if (snap.exists()) continue;
                await withTimeout(c.fb.set(ref, { owner: c.uid, t: c.fb.serverTimestamp(), data }), 60000, 'おくるのに 時間が かかりすぎました');
                return code;
            }
        } catch (e) {
            throw explain(e);
        }
        throw new Error('コードを つくれませんでした。もう一度 おしてください');
        });
    }

    /** コードの データ（文字）。ない ときは null */
    async function download(code) {
        return using(async (c) => {
            try {
                if (c.fake) return await c.fake.get(code);
                const snap = await withTimeout(c.fb.get(c.fb.ref(c.db, PATH + code)), 60000, 'つうしんに 時間が かかりすぎました');
                const v = snap.val();
                return v && typeof v.data === 'string' ? v.data : null;
            } catch (e) {
                throw explain(e);
            }
        });
    }

    /* ================================================================
       クラス（せんせいが つくる。こどもは URL で はいる）
       ohajiki/classes/{code}/
         owner              つくった せんせいの 匿名ID
         cfg                クラスの なまえ・あいことば・つかえる きのう・せってい・ページの ばんごう
         pages              はじめに くばる ページ（しゃしん つき の JSON 文字）
         kids/{kid}         こどもの いまの つくえ（uid・ばんごう・なまえ・つながり・ページ）
         imgs/{kid}/{id}    こどもが じぶんで 入れた しゃしん（小さく した もの）
       ================================================================ */
    const CPATH = 'ohajiki/classes/';
    const T = (p, ms) => withTimeout(p, ms || TIMEOUT, 'つうしんに 時間が かかりすぎました');

    async function uid() { const c = await connect(); return c.fake ? 'fake' : c.uid; }

    /** あたらしい クラスを つくって コードを かえす */
    async function createClass(cfg, pages) {
        return using(async (c) => {
            try {
                for (let i = 0; i < 8; i++) {
                    const code = newCode();
                    const base = CPATH + code;
                    if ((await T(c.fb.get(c.fb.ref(c.db, base + '/owner')))).exists()) continue;
                    await T(c.fb.set(c.fb.ref(c.db, base + '/owner'), c.uid));
                    await T(c.fb.set(c.fb.ref(c.db, base + '/cfg'), Object.assign({}, cfg, { t: c.fb.serverTimestamp() })));
                    await T(c.fb.set(c.fb.ref(c.db, base + '/pages'), pages || ''), 60000);
                    return code;
                }
            } catch (e) { throw explain(e); }
            throw new Error('コードを つくれませんでした。もう一度 おしてください');
        });
    }

    async function getClass(code) {
        return using(async (c) => {
            try {
                const [o, g] = await Promise.all([
                    T(c.fb.get(c.fb.ref(c.db, CPATH + code + '/owner'))),
                    T(c.fb.get(c.fb.ref(c.db, CPATH + code + '/cfg'))),
                ]);
                if (!o.exists() || !g.exists()) return null;
                return { owner: o.val(), cfg: g.val(), mine: o.val() === c.uid };
            } catch (e) { throw explain(e); }
        });
    }

    async function getPages(code) {
        return using(async (c) => {
            try { return (await T(c.fb.get(c.fb.ref(c.db, CPATH + code + '/pages')), 60000)).val() || ''; } catch (e) { throw explain(e); }
        });
    }

    async function saveCfg(code, cfg) {
        return using(async (c) => {
            try { await T(c.fb.set(c.fb.ref(c.db, CPATH + code + '/cfg'), Object.assign({}, cfg, { t: c.fb.serverTimestamp() }))); } catch (e) { throw explain(e); }
        });
    }

    async function savePages(code, pages) {
        return using(async (c) => {
            try { await T(c.fb.set(c.fb.ref(c.db, CPATH + code + '/pages'), pages), 60000); } catch (e) { throw explain(e); }
        });
    }

    /** code の cfg が かわる たびに cb。やめる ときは かえり値の 関数を よぶ（その あいだ つないだ まま） */
    async function watchCfg(code, cb) {
        const c = await connect();
        hold(c);
        const off = c.fb.onValue(c.fb.ref(c.db, CPATH + code + '/cfg'), (snap) => cb(snap.val()), () => {});
        return () => { off(); release(c); };
    }

    /** こどもの つくえを おくる。つながりが きれたら on を false に（onDisconnect） */
    let presenceSet = '';
    async function sendKid(code, kid, data) {
        return using(async (c) => {
        const path = CPATH + code + '/kids/' + kid;
        try {
            await T(c.fb.update(c.fb.ref(c.db, path), Object.assign({}, data, { uid: c.uid, on: true, t: c.fb.serverTimestamp() })));
            if (presenceSet !== path) {
                presenceSet = path;
                await c.fb.onDisconnect(c.fb.ref(c.db, path + '/on')).set(false);
            }
        } catch (e) { throw explain(e); }
        });
    }

    async function putImg(code, kid, id, dataUrl) {
        return using(async (c) => {
            try { await T(c.fb.set(c.fb.ref(c.db, CPATH + code + '/imgs/' + kid + '/' + id), dataUrl), 60000); } catch (e) { throw explain(e); }
        });
    }

    async function getImg(code, path) {
        return using(async (c) => {
            try { return (await T(c.fb.get(c.fb.ref(c.db, CPATH + code + '/imgs/' + path)), 60000)).val(); } catch (e) { throw explain(e); }
        });
    }

    /** せんせい：こどもの つくえ ぜんぶを 見はる */
    async function watchKids(code, cb, onErr) {
        const c = await connect();
        hold(c);
        const off = c.fb.onValue(c.fb.ref(c.db, CPATH + code + '/kids'), (snap) => cb(snap.val() || {}), (e) => onErr && onErr(explain(e)));
        return () => { off(); release(c); };
    }

    /** こどもの つくえ・しゃしんを けす（クラスの せっていは のこる） */
    async function clearKids(code) {
        return using(async (c) => {
            try {
                await T(c.fb.set(c.fb.ref(c.db, CPATH + code + '/kids'), null));
                await T(c.fb.set(c.fb.ref(c.db, CPATH + code + '/imgs'), null));
            } catch (e) { throw explain(e); }
        });
    }

    async function removeClass(code) {
        return using(async (c) => {
            try { await T(c.fb.set(c.fb.ref(c.db, CPATH + code), null)); } catch (e) { throw explain(e); }
        });
    }

    root.KukuShare = {
        upload, download, isCode: (s) => /^[0-9]{6}$/.test(s), connect, hold, release,
        cls: { uid, createClass, getClass, getPages, saveCfg, savePages, watchCfg, sendKid, putImg, getImg, watchKids, clearKids, removeClass },
    };
})(window);
