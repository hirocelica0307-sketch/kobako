/* ブロック おはじき ── しゃしん（はいけい）
   ------------------------------------------------------------------
   - とりこんだ しゃしんは 小さく して（長い 辺 2400px まで）
     ブラウザの 中（IndexedDB）に しまいます。つぎに ひらいても のこります。
   - IndexedDB が つかえない ときは、ひらいている あいだだけ おぼえます。
   - カメラ（getUserMedia）で とる ことも できます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const MAX_SIDE = 2400;
    const THUMB = 240;
    const KEEP = 24;           /* さいきんの しゃしんを いくつ のこすか */

    /* ---------- しまう ところ ---------- */

    const memory = new Map();
    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve) => {
            try {
                const req = indexedDB.open('kuku-block', 1);
                req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
                req.onblocked = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
        return dbPromise;
    }

    async function tx(mode, fn) {
        const db = await openDb();
        if (!db) return fn(null);
        return new Promise((resolve) => {
            try {
                const t = db.transaction('photos', mode);
                const store = t.objectStore('photos');
                const out = fn(store);
                t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
                t.onerror = () => resolve(null);
                t.onabort = () => resolve(null);
            } catch (e) {
                resolve(fn(null));
            }
        });
    }

    async function putRecord(rec) {
        memory.set(rec.id, rec);
        await tx('readwrite', s => s && s.put(rec));
    }

    async function getRecord(id) {
        if (memory.has(id)) return memory.get(id);
        const rec = await tx('readonly', s => s && s.get(id));
        if (rec) memory.set(id, rec);
        return rec || null;
    }

    async function allRecords() {
        const list = await tx('readonly', s => s && s.getAll());
        const map = new Map(memory);
        for (const r of (list || [])) map.set(r.id, r);
        return [...map.values()].sort((a, b) => b.time - a.time);
    }

    async function remove(id) {
        memory.delete(id);
        await tx('readwrite', s => s && s.delete(id));
    }

    /** ふるい しゃしんを けす（keepId は けさない） */
    async function prune(keepIds) {
        const list = await allRecords();
        for (const r of list.slice(KEEP)) {
            if (!keepIds.includes(r.id)) await remove(r.id);
        }
    }

    /* ---------- がぞう ---------- */

    function loadImage(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('がぞうを よめません')); };
            img.src = url;   /* Chrome は しゃしんの むき（EXIF）を じどうで なおします */
        });
    }

    function scaled(img, maxSide) {
        const w0 = img.naturalWidth || img.videoWidth || img.width;
        const h0 = img.naturalHeight || img.videoHeight || img.height;
        const k = Math.min(1, maxSide / Math.max(w0, h0));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * k));
        c.height = Math.max(1, Math.round(h0 * k));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        return c;
    }

    function toBlob(canvas, type, q) {
        return new Promise(res => canvas.toBlob(b => res(b), type, q));
    }

    function newId() {
        return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    /** がぞう（Blob・File・canvas・video）を とりこんで しまう。
        { id, image } を かえす（image は そのまま drawImage できる もの） */
    async function importSource(src) {
        const img = src instanceof Blob ? await loadImage(src) : src;
        const big = scaled(img, MAX_SIDE);
        const blob = await toBlob(big, 'image/jpeg', 0.88);
        const thumb = scaled(big, THUMB).toDataURL('image/jpeg', 0.75);
        const id = newId();
        await putRecord({ id, blob, thumb, time: Date.now(), w: big.width, h: big.height });
        cache.set(id, big);
        return { id, image: big };
    }

    const cache = new Map();

    /** しまってある しゃしんを drawImage できる かたちで とりだす */
    async function load(id) {
        if (cache.has(id)) return cache.get(id);
        const rec = await getRecord(id);
        if (!rec) return null;
        try {
            const img = await loadImage(rec.blob);
            cache.set(id, img);
            return img;
        } catch (e) {
            return null;
        }
    }

    async function list() {
        return (await allRecords()).map(r => ({ id: r.id, thumb: r.thumb, time: r.time }));
    }

    /* ---------- カメラ ---------- */

    const camera = {
        stream: null,
        facing: 'environment',

        available() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        },

        async count() {
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                return devs.filter(d => d.kind === 'videoinput').length;
            } catch (e) {
                return 1;
            }
        },

        async start(video, facing) {
            this.stop();
            if (facing) this.facing = facing;
            const want = { width: { ideal: 2560 }, height: { ideal: 1920 } };
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: Object.assign({ facingMode: { ideal: this.facing } }, want), audio: false,
                });
            } catch (e) {
                if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            this.stream = stream;
            video.srcObject = stream;
            await video.play().catch(() => {});
            return stream;
        },

        flip(video) {
            return this.start(video, this.facing === 'environment' ? 'user' : 'environment');
        },

        stop() {
            if (this.stream) this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        },

        /** いまの えを canvas に して かえす */
        grab(video) {
            return scaled(video, MAX_SIDE);
        },
    };

    root.KukuPhotos = { importSource, load, list, remove, prune, camera };
})(window);
