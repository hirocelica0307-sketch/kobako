/* ブロック おはじき ── せんせい から こども へ くばる（Firebase）
   ------------------------------------------------------------------
   ・「かいて あてて」「タイピング つなひき」と おなじ Firebase プロジェクト
     （hiro-kobako）の Realtime Database を つかいます。
   ・くばる ときは 6けたの コードを つくって ohajiki/shares/{コード} に 1回だけ 書きます。
     書いた 人（匿名の ID）だけが 書きかえ・けす ことが できます（database.rules.json）。
   ・Firebase の 読みこみは あとまわし（dynamic import）。ネットが ない ときも 画面は うごきます。
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
        return { db: dbMod.getDatabase(app), fb: dbMod, uid: auth.currentUser.uid };
    }

    function explain(e) {
        const m = String((e && (e.code || e.message)) || e);
        if (/permission/i.test(m)) return new Error('Firebase の ルールが まだ はられて いません（README の「Firebase の ルール」を みてください）');
        return e instanceof Error ? e : new Error(m);
    }

    const newCode = () => String(100000 + Math.floor(Math.random() * 900000));

    /** data（文字）を くばって、6けたの コードを かえす */
    async function upload(data) {
        const c = await connect();
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
    }

    /** コードの データ（文字）。ない ときは null */
    async function download(code) {
        const c = await connect();
        try {
            if (c.fake) return await c.fake.get(code);
            const snap = await withTimeout(c.fb.get(c.fb.ref(c.db, PATH + code)), 60000, 'つうしんに 時間が かかりすぎました');
            const v = snap.val();
            return v && typeof v.data === 'string' ? v.data : null;
        } catch (e) {
            throw explain(e);
        }
    }

    root.KukuShare = { upload, download, isCode: (s) => /^[0-9]{6}$/.test(s) };
})(window);
