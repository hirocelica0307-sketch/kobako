/* 九九ラン ── 3D の せかい（Three.js）
   道・ゲート（問題と こたえの パネル）・ランナー・まわりの 木や ブロック・かけら・スピード線を つくって うごかします。
   ゲームの きまり（正解かどうか・いのち・はやさ）は main.js が きめます。ここは「見せる」だけ。

   おもく しない くふう：
   - かげは 計算しない（足もとに まるい かげの 板を おくだけ）。ライトは 2つ・Lambert（かるい 材質）
   - 木・ブロック・道の 点線・かけら・スピード線は InstancedMesh（なんこ あっても 1回で かく）
   - まわりの けしきは グループごと うごかし、うしろへ ぬけた ものだけ 前へ もどす
   - ゲートは 4つを つかいまわす。数字の 絵（canvas）は 問題が かわった ときだけ かきなおす
   - ループの 中では あたらしい オブジェクトを つくらない
   - 画面の こまかさ（pixelRatio）は 1.5 まで。おそい 端末では じどうで さげる */
(function (root) {
    'use strict';
    const T = root.THREE;

    /* ---------- 大きさ（1 ＝ だいたい 1m） ---------- */
    const LANE_W = 2.7;           /* レーンの はば */
    const GATE_COUNT = 4;         /* ゲートの 数（つかいまわし） */
    const FAR_Z = -230;           /* けしきの いちばん おく */
    const NEAR_Z = 26;            /* これより 手前に きたら おくへ もどす */
    const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';

    const COL = {
        sky: 0x8fd3ff,
        grass: 0x6bdc4f,
        road: 0xf3f4f7,
        roadEdge: 0xd9dde6,
        dash: 0x2747c9,
        post: 0x2747c9,
        divider: 0xf4f4f4,
        panel: '#f7c331',
        panelEdge: '#d18f00',
        panelText: '#1c2445',
        reviewPanel: '#ffb3c7',
        reviewEdge: '#e0457b',
    };

    function rnd(a, b) { return a + Math.random() * (b - a); }

    /* ---------- canvas の 文字 ---------- */
    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    }
    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }
    function canvasTexture(canvas, renderer) {
        const tx = new T.CanvasTexture(canvas);
        tx.colorSpace = T.SRGBColorSpace;
        tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        tx.generateMipmaps = true;
        tx.minFilter = T.LinearMipmapLinearFilter;
        return tx;
    }

    /** こたえの パネルの 絵（state：'normal' ・ 'review' ・ 'good'（正解を 見せる）） */
    function drawPanel(canvas, value, state) {
        const g = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        g.clearRect(0, 0, W, H);
        const face = state === 'good' ? '#7be07b' : state === 'review' ? COL.reviewPanel : COL.panel;
        const edge = state === 'good' ? '#1f9a3e' : state === 'review' ? COL.reviewEdge : COL.panelEdge;
        g.fillStyle = edge;
        roundRect(g, 0, 0, W, H, 26); g.fill();
        g.fillStyle = face;
        roundRect(g, 12, 12, W - 24, H - 24, 18); g.fill();
        const s = String(value);
        g.fillStyle = COL.panelText;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const size = s.length >= 2 ? 150 : 170;
        g.font = `800 ${size}px ${FONT}`;
        g.fillText(s, W / 2, H / 2 + size * 0.06);
    }

    /** ゲートの 上の 問題の 絵 */
    function drawBanner(canvas, q, review) {
        const g = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        g.clearRect(0, 0, W, H);
        g.fillStyle = review ? '#ff7aa2' : '#ffffff';
        g.fillRect(0, 0, W, H);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (review) {
            g.fillStyle = '#ffffff';
            g.font = `800 34px ${FONT}`;
            g.fillText('もういちど！', W / 2, 26);
            g.font = `800 66px ${FONT}`;
            g.fillText(`${q.a} × ${q.b} = ?`, W / 2, H / 2 + 22);
        } else {
            g.fillStyle = COL.panelText;
            g.font = `800 76px ${FONT}`;
            g.fillText(`${q.a} × ${q.b} = ?`, W / 2, H / 2 + 6);
        }
    }

    function blobTexture() {
        const c = makeCanvas(64, 64);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, 'rgba(0,0,0,0.42)');
        gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        return new T.CanvasTexture(c);
    }

    /* ======================================================================
       せかいを つくる
       ====================================================================== */
    function createWorld(canvas, opts) {
        opts = opts || {};
        let lite = !!opts.lite;

        const dpr = root.devicePixelRatio || 1;
        const renderer = new T.WebGLRenderer({
            canvas, antialias: dpr < 1.5, powerPreference: 'high-performance', stencil: false,
        });
        let maxRatio = lite ? 1 : Math.min(dpr, 1.5);
        let ratio = maxRatio;
        renderer.setPixelRatio(ratio);
        renderer.setClearColor(COL.sky, 1);

        const scene = new T.Scene();
        scene.background = new T.Color(COL.sky);
        scene.fog = new T.Fog(COL.sky, 60, 200);

        const camera = new T.PerspectiveCamera(60, 1, 0.5, 260);

        /* ライト（かげなし） */
        scene.add(new T.HemisphereLight(0xffffff, 0x7f9a6a, 2.1));
        const sun = new T.DirectionalLight(0xffffff, 1.9);
        sun.position.set(4, 10, 6);
        scene.add(sun);

        const lambert = color => new T.MeshLambertMaterial({ color });
        const box = new T.BoxGeometry(1, 1, 1);

        /* ---------- じめん・道 ---------- */
        const ground = new T.Mesh(new T.PlaneGeometry(600, 600), lambert(COL.grass));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.02, -120);
        scene.add(ground);

        const road = new T.Mesh(new T.PlaneGeometry(1, 300), lambert(COL.road));
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0, -120);
        scene.add(road);
        const edgeL = new T.Mesh(new T.PlaneGeometry(0.35, 300), lambert(COL.roadEdge));
        const edgeR = edgeL.clone();
        for (const e of [edgeL, edgeR]) { e.rotation.x = -Math.PI / 2; e.position.set(0, 0.005, -120); scene.add(e); }

        /* 道の 点線（グループごと うごかす。1しゅうき ＝ DASH_GAP） */
        const DASH_GAP = 6, DASH_N = 44;
        const dashes = new T.InstancedMesh(new T.PlaneGeometry(0.16, 2.6), new T.MeshLambertMaterial({ color: COL.dash }), DASH_N * 2);
        dashes.rotation.x = -Math.PI / 2;
        const dashGroup = new T.Group();
        dashGroup.add(dashes);
        scene.add(dashGroup);

        /* ---------- まわりの けしき ---------- */
        const scenery = new T.Group();
        scene.add(scenery);
        const TREE_N = 44, BLOCK_N = 56;      /* 「かるい」の ときは かく 数を へらす（count） */
        const trunks = new T.InstancedMesh(box, lambert(0x8a5a2b), TREE_N);
        const leaves = new T.InstancedMesh(box, lambert(0xffffff), TREE_N);
        const blocks = new T.InstancedMesh(box, lambert(0xffffff), BLOCK_N);
        scenery.add(trunks, leaves, blocks);
        /* 木や ブロックは うごいて いれかわるので、さいしょの 大きさで「見えない」と きめつけない */
        trunks.frustumCulled = leaves.frustumCulled = blocks.frustumCulled = false;
        const trees = [], cubes = [];
        const leafColors = [0x2f9e3a, 0x3cb043, 0x228b3b, 0x56c25a].map(c => new T.Color(c));
        const blockColors = [0xff6f91, 0xb07cf0, 0x2ec4b6, 0xff5a4f, 0xffc93c, 0x5b8def, 0xf78fb3].map(c => new T.Color(c));
        const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3();
        let sceneryOffset = 0;
        let roadHalf = 4;

        function sideX(minFromRoad, spread) {
            const side = Math.random() < 0.5 ? -1 : 1;
            return side * (roadHalf + minFromRoad + Math.random() * spread);
        }
        function placeTree(i, z) {
            const t = trees[i] || (trees[i] = {});
            t.x = sideX(2.2, 34);
            t.z = z;
            t.s = rnd(0.8, 1.5);
            t.h = rnd(1.0, 2.0);
            setTreeMatrix(i);
            leaves.setColorAt(i, leafColors[(Math.random() * leafColors.length) | 0]);
        }
        function setTreeMatrix(i) {
            const t = trees[i];
            Q.identity();
            V.set(t.x, t.h * 0.5 * t.s, t.z); S.set(0.5 * t.s, t.h * t.s, 0.5 * t.s);
            M.compose(V, Q, S); trunks.setMatrixAt(i, M);
            V.set(t.x, (t.h + 0.9) * t.s, t.z); S.set(2 * t.s, 1.8 * t.s, 2 * t.s);
            M.compose(V, Q, S); leaves.setMatrixAt(i, M);
        }
        /* ブロックは 1〜3だん つみ。つみかさねは となりの 番号で つくる */
        function placeBlockStack(i, z) {
            const x = sideX(1.6, 28);
            const size = rnd(0.9, 1.6);
            const n = Math.min(BLOCK_N - i, 1 + ((Math.random() * 3) | 0));
            for (let k = 0; k < n; k++) {
                const c = cubes[i + k] || (cubes[i + k] = {});
                c.x = x; c.z = z; c.y = size * (k + 0.5); c.s = size; c.stack = i; c.n = n;
                Q.identity(); V.set(c.x, c.y, c.z); S.set(size, size, size);
                M.compose(V, Q, S); blocks.setMatrixAt(i + k, M);
                blocks.setColorAt(i + k, blockColors[(Math.random() * blockColors.length) | 0]);
            }
            return n;
        }
        function layoutScenery() {
            sceneryOffset = 0;
            scenery.position.z = 0;
            for (let i = 0; i < TREE_N; i++) placeTree(i, FAR_Z + (i + Math.random()) * ((NEAR_Z - FAR_Z) / TREE_N));
            for (let i = 0; i < BLOCK_N;) {
                const z = FAR_Z + Math.random() * (NEAR_Z - FAR_Z);
                i += placeBlockStack(i, z);
            }
            trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = blocks.instanceMatrix.needsUpdate = true;
            leaves.instanceColor.needsUpdate = blocks.instanceColor.needsUpdate = true;
        }

        /* とおくの 山（うごかない） */
        {
            const hillMat = new T.MeshLambertMaterial({ color: 0x7ccf6a });
            const hillGeo = new T.ConeGeometry(1, 1, 5);
            for (let i = 0; i < 9; i++) {
                const h = new T.Mesh(hillGeo, hillMat);
                const w = rnd(30, 60);
                h.scale.set(w, rnd(14, 26), w);
                h.position.set(-160 + i * 40 + rnd(-10, 10), 0, -250 - rnd(0, 20));
                h.matrixAutoUpdate = false; h.updateMatrix();
                scene.add(h);
            }
        }

        /* ---------- ランナー ---------- */
        const player = new T.Group();
        scene.add(player);
        const body = new T.Group();       /* ころぶ ときに まわす ぶぶん */
        player.add(body);
        const skin = lambert(0xf0c391), shirt = lambert(0xf28a2e), pants = lambert(0x24339a);
        const capMat = lambert(0x2b4fd8), bagMat = lambert(0xf8c934);
        function part(mat, w, h, d, x, y, z, parent) {
            const m = new T.Mesh(box, mat);
            m.scale.set(w, h, d);
            m.position.set(x, y, z);
            (parent || body).add(m);
            return m;
        }
        const hipL = new T.Group(), hipR = new T.Group(), shL = new T.Group(), shR = new T.Group();
        hipL.position.set(-0.2, 0.85, 0); hipR.position.set(0.2, 0.85, 0);
        shL.position.set(-0.55, 1.58, 0); shR.position.set(0.55, 1.58, 0);
        body.add(hipL, hipR, shL, shR);
        part(pants, 0.34, 0.85, 0.36, 0, -0.42, 0, hipL);
        part(pants, 0.34, 0.85, 0.36, 0, -0.42, 0, hipR);
        part(skin, 0.24, 0.72, 0.26, 0, -0.34, 0, shL);
        part(skin, 0.24, 0.72, 0.26, 0, -0.34, 0, shR);
        part(shirt, 0.9, 0.85, 0.52, 0, 1.25, 0);
        part(bagMat, 0.72, 0.66, 0.28, 0, 1.3, 0.38);
        part(lambert(0xe3a400), 0.5, 0.2, 0.06, 0, 1.18, 0.54);
        part(skin, 0.62, 0.6, 0.6, 0, 1.99, 0);
        part(capMat, 0.66, 0.2, 0.66, 0, 2.36, 0);
        part(capMat, 0.62, 0.07, 0.32, 0, 2.28, -0.45);
        const shadow = new T.Mesh(new T.PlaneGeometry(1.6, 1.6),
            new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        scene.add(shadow);

        const run = {
            lane: 0, x: 0, phase: 0, tumble: 0, laneXs: [0], lean: 0,
        };

        /* ---------- ゲート ---------- */
        const postMat = lambert(COL.post), dividerMat = lambert(COL.divider);
        const sideMat = lambert(0xd9a21a);
        const gates = [];
        for (let gi = 0; gi < GATE_COUNT; gi++) {
            const group = new T.Group();
            group.visible = false;
            scene.add(group);
            const postL = part(postMat, 0.35, 5.4, 0.35, 0, 2.7, 0, group);
            const postR = part(postMat, 0.35, 5.4, 0.35, 0, 2.7, 0, group);
            const bannerCanvas = makeCanvas(512, 128);
            const bannerTex = canvasTexture(bannerCanvas, renderer);
            const banner = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: bannerTex }));
            banner.position.set(0, 4.75, 0.2);
            group.add(banner);
            const bannerBack = part(postMat, 1, 1.1, 0.2, 0, 4.75, 0.05, group);
            const panels = [];
            for (let k = 0; k < 3; k++) {
                const c = makeCanvas(256, 256);
                const tex = canvasTexture(c, renderer);
                const face = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex }));
                const back = new T.Mesh(box, sideMat);
                group.add(face, back);
                panels.push({ canvas: c, tex, face, back, value: 0 });
            }
            const dividers = [part(dividerMat, 0.18, 2.5, 0.4, 0, 1.25, 0, group), part(dividerMat, 0.18, 2.5, 0.4, 0, 1.25, 0, group)];
            gates.push({
                group, postL, postR, banner, bannerBack, bannerCanvas, bannerTex, panels, dividers,
                z: -9999, q: null, answers: [], correct: 0, resolved: true, active: false,
            });
        }

        /* ---------- かけら（ブロックの はへん） ---------- */
        const BITS = 180;
        const bits = new T.InstancedMesh(box, new T.MeshLambertMaterial({ color: 0xffffff }), BITS);
        bits.frustumCulled = false;
        scene.add(bits);
        const bitState = [];
        for (let i = 0; i < BITS; i++) {
            bitState.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, rx: 0, ry: 0, vr: 0 });
            M.makeScale(0, 0, 0); bits.setMatrixAt(i, M);
            bits.setColorAt(i, blockColors[0]);
        }
        let bitNext = 0, bitsAlive = 0;
        const E = new T.Euler();
        const tmpColor = new T.Color();

        /* ---------- スピード線 ---------- */
        const LINES = 36;
        const lineMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
        const lines = new T.InstancedMesh(box, lineMat, Math.max(1, LINES));
        lines.frustumCulled = false;
        scene.add(lines);
        const lineState = [];
        for (let i = 0; i < LINES; i++) lineState.push(resetLine({}, true));
        function resetLine(l, anywhere) {
            const ang = Math.random() * Math.PI * 2;
            const r = rnd(3.5, 9);
            l.x = Math.cos(ang) * r * 1.4;
            l.y = 2.5 + Math.sin(ang) * r * 0.8;
            l.z = anywhere ? rnd(-90, 10) : rnd(-110, -70);
            l.len = rnd(2.5, 6);
            return l;
        }

        /* ---------- レーン ---------- */
        function setLanes(n) {
            run.laneXs = [];
            for (let i = 0; i < n; i++) run.laneXs.push((i - (n - 1) / 2) * LANE_W);
            roadHalf = (n * LANE_W) / 2 + 0.7;
            road.scale.x = roadHalf * 2;
            edgeL.position.x = -roadHalf; edgeR.position.x = roadHalf;
            /* 点線：レーンの さかいめ（n−1本） */
            let k = 0;
            for (let b = 0; b < n - 1; b++) {
                const x = (run.laneXs[b] + run.laneXs[b + 1]) / 2;
                for (let j = 0; j < DASH_N; j++) {
                    /* dashes は x 軸で 90°まわしてあるので、y が おく ゆき */
                    M.makeTranslation(x, -(NEAR_Z - j * DASH_GAP), 0.01);
                    dashes.setMatrixAt(k++, M);
                }
            }
            dashes.count = k;
            dashes.instanceMatrix.needsUpdate = true;
            /* ゲート */
            for (const g of gates) layoutGate(g, n);
            /* 2まいなら 左・3まいなら まんなかから */
            run.lane = Math.floor((n - 1) / 2);
            run.x = run.laneXs[run.lane];
            layoutScenery();
        }

        function layoutGate(g, n) {
            const half = roadHalf - 0.1;
            g.postL.position.x = -half; g.postR.position.x = half;
            g.banner.scale.set(Math.min(half * 2 - 0.5, 6.4), 1.6, 1);
            g.bannerBack.scale.x = half * 2;
            const pw = LANE_W - 0.3;
            g.panels.forEach((p, k) => {
                const on = k < n;
                p.face.visible = p.back.visible = on;
                if (!on) return;
                const x = run.laneXs[k];
                p.face.scale.set(pw, pw * 0.92, 1);
                p.face.position.set(x, 1.55, 0.17);
                p.back.scale.set(pw, pw * 0.92, 0.3);
                p.back.position.set(x, 1.55, 0);
            });
            g.dividers.forEach((d, k) => {
                d.visible = k < n - 1;
                if (d.visible) d.position.x = (run.laneXs[k] + run.laneXs[k + 1]) / 2;
            });
            g.panelCount = n;
        }

        /** ゲートに 問題を はる */
        function assignGate(g, q, answers, correct, z) {
            g.q = q; g.answers = answers; g.correct = correct;
            g.z = z; g.group.position.z = z;
            g.resolved = false; g.active = true; g.group.visible = true;
            drawBanner(g.bannerCanvas, q, q.review);
            g.bannerTex.needsUpdate = true;
            for (let k = 0; k < g.panelCount; k++) {
                const p = g.panels[k];
                p.value = answers[k];
                p.face.visible = p.back.visible = true;
                drawPanel(p.canvas, answers[k], q.review ? 'review' : 'normal');
                p.tex.needsUpdate = true;
            }
        }

        function hideGate(g) {
            g.active = false; g.resolved = true; g.group.visible = false; g.z = -9999;
        }

        /** パネルを こわす（good：正解の いろの かけら） */
        function breakPanel(g, k, good) {
            const p = g.panels[k];
            if (!p) return;
            p.face.visible = p.back.visible = false;
            const x = run.laneXs[k];
            const cols = good ? [0xf7c331, 0xf7c331, 0x1c2445, 0xffffff, 0x7be07b] : [0xff5a4f, 0x1c2445, 0xf7c331, 0x333333];
            burst(x, 1.55, g.z + 0.2, good ? (lite ? 14 : 26) : (lite ? 16 : 30), cols, good ? 1 : 1.4);
        }

        /** 正解の パネルを みどりに して 見せる（まちがえた とき） */
        function showCorrect(g) {
            const p = g.panels[g.correct];
            if (!p || !p.face.visible) return;
            drawPanel(p.canvas, p.value, 'good');
            p.tex.needsUpdate = true;
        }

        function burst(x, y, z, n, colors, power) {
            for (let i = 0; i < n; i++) {
                const b = bitState[bitNext];
                const idx = bitNext;
                bitNext = (bitNext + 1) % BITS;
                if (b.life <= 0) bitsAlive++;
                b.life = rnd(0.7, 1.3);
                b.x = x + rnd(-1, 1); b.y = y + rnd(-0.9, 0.9); b.z = z;
                b.vx = rnd(-5, 5) * power; b.vy = rnd(2, 8) * power; b.vz = rnd(-3, 7);
                b.s = rnd(0.18, 0.42);
                b.rx = rnd(0, 6); b.ry = rnd(0, 6); b.vr = rnd(-9, 9);
                tmpColor.setHex(colors[(Math.random() * colors.length) | 0]);
                bits.setColorAt(idx, tmpColor);
            }
            bits.instanceColor.needsUpdate = true;
        }

        /** ころぶ */
        function crash() {
            run.tumble = 1;
            shake = 0.6;
        }

        /* ---------- カメラ ---------- */
        let viewW = 1, viewH = 1, aspect = 1;
        let camDist = 9, camY = 4.4, baseFov = 60;
        let shake = 0;
        function resize() {
            const r = canvas.getBoundingClientRect();
            viewW = Math.max(1, r.width); viewH = Math.max(1, r.height);
            aspect = viewW / viewH;
            renderer.setSize(viewW, viewH, false);
            /* たて画面でも 道の はばが ぜんぶ 見えるように カメラを うしろへ */
            baseFov = aspect < 0.8 ? 64 : 56;
            const halfH = Math.tan(T.MathUtils.degToRad(baseFov / 2));
            /* ランナーの いる ところで、はしの レーンの パネルが 見きれない はば */
            const need = run.laneXs[run.laneXs.length - 1] + LANE_W * 0.5 + 0.35;
            camDist = Math.max(8.5, need / (halfH * aspect));
            camY = 3.4 + camDist * 0.22;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        }

        /* ---------- まいフレーム ---------- */
        let speedNorm = 0;     /* 0〜1（スピード線・カメラの ひろがり） */
        function step(dt, speed, norm) {
            speedNorm = norm || 0;
            const dz = speed * dt;

            /* けしき：グループを うごかし、手前に ぬけた ものだけ おくへ */
            sceneryOffset += dz;
            scenery.position.z = sceneryOffset;
            let tm = false, bm = false;
            for (let i = 0; i < TREE_N; i++) {
                const t = trees[i];
                if (t.z + sceneryOffset > NEAR_Z) {
                    placeTree(i, t.z - (NEAR_Z - FAR_Z));
                    tm = true;
                }
            }
            for (let i = 0; i < BLOCK_N; i++) {
                const c = cubes[i];
                if (c.stack === i && c.z + sceneryOffset > NEAR_Z) {
                    const newZ = c.z - (NEAR_Z - FAR_Z);
                    /* おなじ つみかさねの なかまも いっしょに */
                    const keep = c.n;
                    const x = sideX(1.6, 28);
                    for (let k = 0; k < keep; k++) {
                        const d = cubes[i + k];
                        d.z = newZ; d.x = x;
                        Q.identity(); V.set(d.x, d.y, d.z); S.set(d.s, d.s, d.s);
                        M.compose(V, Q, S); blocks.setMatrixAt(i + k, M);
                    }
                    bm = true;
                }
            }
            if (tm) { trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true; leaves.instanceColor.needsUpdate = true; }
            if (bm) blocks.instanceMatrix.needsUpdate = true;
            /* 点線：1しゅうき ぶんの くりかえし */
            dashGroup.position.z = (dashGroup.position.z + dz) % DASH_GAP;

            /* ゲート */
            for (const g of gates) {
                if (!g.active) continue;
                g.z += dz;
                g.group.position.z = g.z;
                /* カメラの すぐ 前まで きたら けす（大きな 板が 画面を ふさがない ように） */
                g.group.visible = g.z < camDist - 2.5;
            }

            /* ランナー */
            const targetX = run.laneXs[run.lane] || 0;
            const prevX = run.x;
            run.x += (targetX - run.x) * Math.min(1, dt * 13);
            const vx = dt > 0 ? (run.x - prevX) / dt : 0;
            run.lean += (-vx * 0.05 - run.lean) * Math.min(1, dt * 10);
            player.position.x = run.x;
            shadow.position.x = run.x;
            const moving = speed > 0.5;
            run.phase += dt * (moving ? Math.min(20, 7 + speed * 0.18) : 2);
            const sw = moving ? 0.9 : 0.08;
            const s1 = Math.sin(run.phase);
            hipL.rotation.x = s1 * sw; hipR.rotation.x = -s1 * sw;
            shL.rotation.x = -s1 * sw * 0.9; shR.rotation.x = s1 * sw * 0.9;
            body.position.y = moving ? Math.abs(Math.cos(run.phase)) * 0.14 : 0;
            body.rotation.z = run.lean;
            if (run.tumble > 0) {
                run.tumble = Math.max(0, run.tumble - dt * 1.4);
                const k = 1 - run.tumble;
                body.rotation.x = Math.sin(k * Math.PI) * -1.1;
                body.rotation.y = k * Math.PI * 2;
                body.position.y += Math.sin(k * Math.PI) * 0.8;
            } else {
                body.rotation.x = moving ? -0.12 : 0;
                body.rotation.y = 0;
            }

            /* かけら */
            if (bitsAlive > 0) {
                for (let i = 0; i < BITS; i++) {
                    const b = bitState[i];
                    if (b.life <= 0) continue;
                    b.life -= dt;
                    if (b.life <= 0) {
                        bitsAlive--;
                        M.makeScale(0, 0, 0); bits.setMatrixAt(i, M);
                        continue;
                    }
                    b.vy -= 22 * dt;
                    b.x += b.vx * dt; b.y += b.vy * dt; b.z += (b.vz * dt) + dz;
                    if (b.y < b.s / 2) { b.y = b.s / 2; b.vy *= -0.35; b.vx *= 0.7; }
                    b.rx += b.vr * dt; b.ry += b.vr * 0.7 * dt;
                    const sc = b.s * Math.min(1, b.life * 3);
                    E.set(b.rx, b.ry, 0); Q.setFromEuler(E);
                    V.set(b.x, b.y, b.z); S.set(sc, sc, sc);
                    M.compose(V, Q, S); bits.setMatrixAt(i, M);
                }
                bits.instanceMatrix.needsUpdate = true;
            }

            /* スピード線 */
            if (LINES) {
                const on = speedNorm > 0.45 && !lite;
                const target = on ? Math.min(0.75, (speedNorm - 0.45) * 2) : 0;
                lineMat.opacity += (target - lineMat.opacity) * Math.min(1, dt * 4);
                lines.visible = lineMat.opacity > 0.02;
                if (lines.visible) {
                    for (let i = 0; i < LINES; i++) {
                        const l = lineState[i];
                        l.z += dz * 2.2 + dt * 30;
                        if (l.z > 12) resetLine(l, false);
                        Q.identity(); V.set(l.x + run.x * 0.3, l.y, l.z); S.set(0.05, 0.05, l.len);
                        M.compose(V, Q, S); lines.setMatrixAt(i, M);
                    }
                    lines.instanceMatrix.needsUpdate = true;
                }
            }

            /* カメラ */
            const fov = baseFov + speedNorm * 8;
            if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
            shake = Math.max(0, shake - dt * 1.6);
            const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
            const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
            camera.position.set(run.x * 0.35 + sx, camY + sy, camDist);
            camera.lookAt(run.x * 0.2, 0.9, -12);
        }

        /* ---------- かく（おそい 端末では こまかさを さげる） ---------- */
        let slowFrames = 0, fastFrames = 0;
        function render(dt) {
            renderer.render(scene, camera);
            if (dt > 0) {
                if (dt > 1 / 40) { slowFrames++; fastFrames = 0; } else { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
                if (slowFrames > 45 && ratio > 0.75) {
                    ratio = Math.max(0.75, ratio - 0.25);
                    renderer.setPixelRatio(ratio); resize(); slowFrames = 0;
                } else if (fastFrames > 600 && ratio < maxRatio) {
                    ratio = Math.min(maxRatio, ratio + 0.25);
                    renderer.setPixelRatio(ratio); resize(); fastFrames = 0;
                }
            }
        }

        function setLite(v) {
            lite = !!v;
            applyLiteCounts();
            maxRatio = lite ? 1 : Math.min(dpr, 1.5);
            ratio = Math.min(ratio, maxRatio);
            if (!lite) ratio = maxRatio;
            renderer.setPixelRatio(ratio);
            resize();
        }

        function reset() {
            for (const g of gates) hideGate(g);
            for (let i = 0; i < BITS; i++) { bitState[i].life = 0; M.makeScale(0, 0, 0); bits.setMatrixAt(i, M); }
            bitsAlive = 0;
            bits.instanceMatrix.needsUpdate = true;
            run.tumble = 0; shake = 0;
            body.rotation.set(0, 0, 0);
            lineMat.opacity = 0;
        }

        function applyLiteCounts() {
            trunks.count = leaves.count = lite ? 24 : TREE_N;
            blocks.count = lite ? 28 : BLOCK_N;
        }

        applyLiteCounts();
        setLanes(2);
        resize();
        step(0, 0, 0);

        return {
            gates, renderer,
            get lane() { return run.lane; },
            get laneCount() { return run.laneXs.length; },
            setLane(i) { run.lane = Math.max(0, Math.min(run.laneXs.length - 1, i)); },
            setLanes, assignGate, hideGate, breakPanel, showCorrect, crash, step, render, resize, reset, setLite,
            get pixelRatio() { return ratio; },
        };
    }

    root.KukuRunWorld = { createWorld, LANE_W, GATE_COUNT };
})(window);
