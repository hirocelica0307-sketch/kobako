/* たのしい プリント ── てつぼう わざ カード の データと え
   ------------------------------------------------------------------
   わざは 小学校学習指導要領解説 体育編の 例示を もとに、学年ごとに ならべています。
     low  … 1・2年「てつぼうを つかった うんどう あそび」
     mid  … 3・4年「鉄棒運動」（きほんの わざ）
     high … 5・6年「鉄棒運動」（はってん わざ・さらに はってん）
   え は よこから 見た ぼう人間。てつぼうは (0,0) の ●、ゆかは y = 2.4。
   人は みぎを むいて いて、まえ（みぎ）へ まわるのが「まえ まわり」。
   {漢字|かんじ} は ふりがなに なります。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const JOINTS = ['w', 'e', 's', 'h', 'k', 'f', 'k2', 'f2'];
    /* w 手・e ひじ・s かた・h こし・k ひざ・f 足・k2 f2 もう 1本の 足 */

    const rad = d => d * Math.PI / 180;
    function rot(p, deg) {
        const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), o = { ...p };
        for (const j of JOINTS) if (p[j]) o[j] = [p[j][0] * c - p[j][1] * s, p[j][0] * s + p[j][1] * c];
        return o;
    }
    function mir(p) {
        const o = { ...p };
        for (const j of JOINTS) if (p[j]) o[j] = [-p[j][0], p[j][1]];
        return o;
    }
    function move(p, dx, dy) {
        const o = { ...p };
        for (const j of JOINTS) if (p[j]) o[j] = [p[j][0] + dx, p[j][1] + dy];
        return o;
    }

    /* ---------- きほんの しせい ---------- */
    const P = {};
    /* てつぼうの まえに 立って にぎる */
    P.stand = { w: [0, 0], s: [-0.55, -0.3], h: [-0.62, 0.8], k: [-0.6, 1.6], f: [-0.62, 2.4], k2: [-0.66, 1.6], f2: [-0.7, 2.4] };
    /* ふみこむ（逆上がりの はじめ） */
    P.kick = { w: [0, 0], e: [-0.25, 0.5], s: [-0.6, 0.05], h: [-0.75, 1.1], k: [-0.35, 1.6], f: [-0.4, 2.4], k2: [-1.05, 1.65], f2: [-1.35, 2.35] };
    /* つばめ（てで ささえる） */
    P.support = { w: [0, 0], s: [-0.12, -0.85], h: [-0.3, 0.22], k: [-0.34, 1.02], f: [-0.3, 1.82], k2: [-0.38, 1.0], f2: [-0.38, 1.8] };
    /* ひざを まげた つばめ（かかえこみ） */
    P.supportTuck = { w: [0, 0], s: [-0.12, -0.85], h: [-0.3, 0.2], k: [0.25, -0.15], f: [0.3, 0.6], k2: [0.2, -0.1], f2: [0.25, 0.65] };
    /* ふとんほし */
    P.futon = { w: [0.4, 1.72], s: [0.38, 0.92], h: [-0.08, -0.12], k: [-0.45, 0.6], f: [-0.5, 1.4], k2: [-0.5, 0.58], f2: [-0.58, 1.38] };
    /* まえに まわる とちゅう（あたまが した） */
    P.fwdHalf = { w: [0, 0], e: [0.35, 0.25], s: [0.32, 0.72], h: [-0.18, -0.22], k: [-0.15, -1.0], f: [0.42, -1.3], k2: [-0.2, -0.98], f2: [0.36, -1.32] };
    /* まえ まわりの あと：ぶらさがって おりる */
    P.landNear = { w: [0, 0], s: [-0.3, 0.78], h: [-0.72, 1.6], k: [-0.25, 1.92], f: [-0.45, 2.4], k2: [-0.3, 1.95], f2: [-0.52, 2.4] };
    /* りょうてで ぶらさがる（さる） */
    P.hang = { w: [0, 0], s: [0, 0.82], h: [-0.05, 1.9], k: [0.55, 2.05], f: [0.45, 2.75], k2: [0.5, 2.1], f2: [0.38, 2.8] };
    /* だんごむし（うでを まげて あごを てつぼうの 上に） */
    P.dango = { w: [0, 0], e: [0.05, 0.5], s: [-0.25, 0.3], h: [-0.3, 1.35], k: [0.35, 1.2], f: [0.3, 1.95], k2: [0.3, 1.25], f2: [0.25, 2.0] };
    /* こうもり（りょうひざで ぶらさがる） */
    P.koumori = { k: [0, 0], f: [0.55, -0.48], k2: [0, 0], f2: [0.5, -0.52], h: [-0.15, 0.8], s: [-0.12, 1.9], w: [-0.1, 2.62] };
    /* ぶたの まるやき */
    P.buta = { w: [0, 0], s: [-0.55, 0.62], h: [0.5, 0.95], k: [0.3, 0.18], f: [-0.25, -0.12], k2: [0.36, 0.2], f2: [-0.2, -0.16] };
    /* ぶらさがりから 足を うでの あいだに とおす（足ぬき回り） */
    P.ashinuki = { w: [0, 0], s: [0.15, 0.82], h: [0.0, -0.25], k: [-0.5, 0.05], f: [-0.4, 0.82], k2: [-0.45, 0.0], f2: [-0.32, 0.78] };
    /* かたひざを かけて ささえる（片膝掛け支持） */
    P.kneeSupport = { w: [0, 0], s: [-0.14, -0.85], h: [-0.32, 0.15], k: [0.4, -0.02], f: [0.45, 0.78], k2: [-0.4, 0.95], f2: [-0.45, 1.75] };
    /* ももを かけて ささえる（もも掛け） */
    P.thighSupport = { w: [0, 0], s: [-0.06, -0.86], h: [-0.18, 0.12], k: [0.62, 0.0], f: [0.68, 0.8], k2: [-0.25, 0.92], f2: [-0.3, 1.72] };
    /* かたひざを かけて ぶらさがり、のばした 足を ふる */
    P.kneeHang = { w: [0, 0], k: [0, 0], s: [-0.72, 0.42], h: [0.28, 0.82], f: [-0.48, -0.42], k2: [1.05, 1.0], f2: [1.75, 1.2] };
    /* 逆上がり：足を てつぼうの 上へ */
    P.kickUp = { w: [0, 0], e: [-0.4, 0.35], s: [-0.5, 0.78], h: [0.02, -0.18], k: [0.48, -0.86], f: [0.82, -1.56], k2: [0.42, -0.9], f2: [0.7, -1.62] };
    /* 両膝掛け倒立下り：こうもりから ゆかに てを つく */
    P.handstand = { k: [0, 0], f: [0.55, -0.48], k2: [0, 0], f2: [0.5, -0.52], h: [-0.15, 0.8], s: [-0.14, 1.68], e: [-0.4, 2.02], w: [-0.3, 2.4] };
    /* 片足踏み越し下り：かたあしを てつぼうに のせる */
    P.stepOn = { w: [0, 0], s: [-0.1, -0.9], h: [-0.45, 0.05], k: [-0.2, -0.55], f: [0.02, -0.05], k2: [-0.6, 0.82], f2: [-0.62, 1.62] };
    /* 横とび越し：足を そろえて てつぼうの 上を よこに */
    P.sideVault = { w: [0, 0], s: [-0.25, -0.75], h: [0.25, -0.35], k: [0.95, -0.42], f: [1.65, -0.45], k2: [0.92, -0.32], f2: [1.6, -0.3] };

    /** とびおりて 立つ（x … ばしょ、dir … 1 で みぎむき、-1 で ひだりむき） */
    function land(x, dir = 1) {
        const p = { s: [0, 0.12], h: [-0.08, 1.12], k: [0.3, 1.66], f: [0.02, 2.4], k2: [0.25, 1.7], f2: [-0.06, 2.4], e: [0.38, 0.45], w: [0.75, 0.6] };
        return move(dir === 1 ? p : mir(p), x, 0);
    }

    /* ---------- わざ ---------- */
    /* frames: [しせい, ことば, { arrow: 'cw'（まえへ）| 'ccw'（うしろへ）, board: 補助具 }] */
    const fr = (p, cap, o) => ({ p, cap, ...(o || {}) });

    const WAZA = [
        /* ===== 1・2年 てつぼう あそび ===== */
        { id: 'tsubame', grade: 'low', group: 'ささえる', stars: 1, name: 'ツバメ',
          frames: [fr(P.stand, 'にぎる'), fr(P.support, 'ピン！')],
          points: ['うでを ピンと のばす', 'おへそを てつぼうに つけて 10びょう'], drill: 'ひくい てつぼうで、とびあがって すぐ ツバメ' },
        { id: 'futon', grade: 'low', group: 'ささえる', stars: 1, name: 'ふとん{干|ほ}し',
          frames: [fr(P.support, 'ツバメから'), fr(P.futon, 'ぶらーん')],
          points: ['おなかを てつぼうに かける', 'ちからを ぬいて ぶらーん。もどる ときは ゆっくり'], drill: 'てを もったまま まえに たおれて みる' },
        { id: 'saru', grade: 'low', group: 'ぶらさがる', stars: 1, name: 'ぶら{下|さ}がり',
          frames: [fr(P.hang, 'さる'), fr(P.dango, 'だんごむし')],
          points: ['おやゆびを まいて しっかり にぎる', 'あしを まげて 10びょう がまん'], drill: 'さいしょは 5びょうから。ともだちと かぞえっこ' },
        { id: 'koumori', grade: 'low', group: 'ぶらさがる', stars: 2, name: 'こうもり',
          frames: [fr(P.koumori, 'りょうひざで')],
          points: ['ひざの うらを しっかり かける', 'なれたら てを はなして ぶらーん'], drill: 'さいしょは てを もったまま。{下|した}に マットを しく' },
        { id: 'buta', grade: 'low', group: 'ぶらさがる', stars: 1, name: 'ぶたの {丸焼|まるや}き',
          frames: [fr(P.buta, 'てと {足|あし}で')],
          points: ['てと {足|あし}を てつぼうに かける', 'おへそを {上|うえ}に むけて 10びょう'], drill: 'ひくい てつぼうで、{足|あし}を かける ところから' },
        { id: 'tobiagari', grade: 'low', group: 'あがる・おりる', stars: 1, name: '{跳|と}び{上|あ}がり・{跳|と}び{下|お}り',
          frames: [fr(P.stand, 'にぎって'), fr(P.support, 'とびあがる'), fr(land(-1.05, 1), 'ふわっと')],
          points: ['うでで おして とびあがる', 'おりる ときは ひざを まげて しずかに'], drill: 'ふみ{台|だい}を つかって とびあがる' },
        { id: 'maemawari-low', grade: 'low', group: 'まわる', stars: 2, name: '{前回|まえまわ}り{下|お}り',
          frames: [fr(P.support, 'ツバメ'), fr(P.fwdHalf, 'まえへ', { arrow: 'cw' }), fr(P.landNear, 'ゆっくり')],
          points: ['あごを ひいて おへそを {見|み}る', 'てを はなさずに ゆっくり おりる'], drill: 'ふとん{干|ほ}しから、てを もったまま まわる' },
        { id: 'ashinuki', grade: 'low', group: 'まわる', stars: 2, name: '{足抜|あしぬ}き{回|まわ}り',
          frames: [fr(P.hang, 'ぶらさがる'), fr(P.ashinuki, '{足|あし}を とおす', { arrow: 'ccw' }), fr(move(mir(P.hang), 0, 0), 'くるん')],
          points: ['りょう{足|あし}を うでの あいだに とおす', 'ゆっくり まわったら、もどって みよう'], drill: 'ひくい てつぼうで、{足|あし}を ゆかに つけたまま' },

        /* ===== 3・4年 鉄棒運動（きほんの わざ） ===== */
        { id: 'maemawari', grade: 'mid', group: 'まえに まわる', stars: 1, name: '{前回|まえまわ}り{下|お}り',
          frames: [fr(P.support, 'つばめ'), fr(P.fwdHalf, 'まえへ', { arrow: 'cw' }), fr(P.landNear, 'ゆっくり')],
          points: ['あごを ひいて、おへそを {見|み}ながら まわる', 'てを はなさずに、{足|あし}から しずかに おりる'], drill: 'ふとん{干|ほ}しから ゆっくり' },
        { id: 'kakaemae', grade: 'mid', group: 'まえに まわる', stars: 2, name: 'かかえ{込|こ}み{前回|まえまわ}り',
          frames: [fr(P.supportTuck, 'かかえる'), fr(rot(P.supportTuck, 150), 'まえへ', { arrow: 'cw' }), fr(P.supportTuck, 'もどる')],
          points: ['ひざを むねに ひきつけて まるく', 'あたまを {大|おお}きく まえへ たおす'], drill: 'てつぼうに タオルを まいて、こしが いたく ない ように' },
        { id: 'tenkou', grade: 'mid', group: 'まえに まわる', stars: 2, name: '{転向前下|てんこうまえお}り',
          frames: [fr(P.support, 'つばめ'), fr(rot(P.support, 70), 'からだを ひねる', { arrow: 'cw' }), fr(land(0.95, -1), 'よこむきに')],
          points: ['かた{手|て}の にぎりを さかてに かえる', 'からだを ひねりながら まえに おりる'], drill: 'せんせいや ともだちに こしを ささえて もらう' },
        { id: 'hizafuri', grade: 'mid', group: 'まえに まわる', stars: 2, name: '{膝掛|ひざか}け{振|ふ}り{上|あ}がり',
          frames: [fr(P.kneeHang, 'ひざを かける'), fr(rot(P.kneeHang, -40), '{足|あし}を ふる', { arrow: 'ccw' }), fr(P.kneeSupport, '{上|あ}がる')],
          points: ['のばした {足|あし}を {大|おお}きく ふる', 'ふりおろす いきおいで {上|あ}がる'], drill: 'ひざを かけて ぶらさがり、{足|あし}を ふる だけ' },
        { id: 'zenpoukata', grade: 'mid', group: 'まえに まわる', stars: 3, name: '{前方片膝掛|ぜんぽうかたひざか}け{回転|かいてん}',
          frames: [fr(P.kneeSupport, 'ひざを かける'), fr(rot(P.kneeSupport, 160), 'まえへ', { arrow: 'cw' }), fr(P.kneeSupport, 'もどる')],
          points: ['てつぼうを ももと ひざで はさむ', 'むねを はって {大|おお}きく まえへ'], drill: 'てを はなさず、ともだちに せなかを ささえて もらう' },
        { id: 'hojosaka', grade: 'mid', group: 'うしろに まわる', stars: 2, name: '{補助逆上|ほじょさかあ}がり',
          frames: [fr(P.kick, 'ふみきる', { board: true }), fr(P.kickUp, 'けりあげる', { arrow: 'ccw', board: true }), fr(P.support, 'つばめ')],
          points: ['ほじょばんを かけあがる', 'おへそを てつぼうに ちかづけ、あごを ひく'], drill: 'ほじょばんや タオルを つかって' },
        { id: 'kakaeushiro', grade: 'mid', group: 'うしろに まわる', stars: 2, name: 'かかえ{込|こ}み{後|うし}ろ{回|まわ}り',
          frames: [fr(P.supportTuck, 'かかえる'), fr(rot(P.supportTuck, -150), 'うしろへ', { arrow: 'ccw' }), fr(P.supportTuck, 'もどる')],
          points: ['ひざを かかえて まるく なる', 'あたまを うしろへ たおして まわる'], drill: 'てつぼうに タオルを まいて' },
        { id: 'kouhoukata', grade: 'mid', group: 'うしろに まわる', stars: 3, name: '{後方片膝掛|こうほうかたひざか}け{回転|かいてん}',
          frames: [fr(P.kneeSupport, 'ひざを かける'), fr(rot(P.kneeSupport, -160), 'うしろへ', { arrow: 'ccw' }), fr(P.kneeSupport, 'もどる')],
          points: ['せなかを のばして うしろへ たおれる', 'ひざを てつぼうに しっかり かける'], drill: 'ひざかけで ぶらさがり、ふる れんしゅう' },
        { id: 'tourituori', grade: 'mid', group: 'おりる', stars: 2, name: '{両膝掛|りょうひざか}け{倒立下|とうりつお}り',
          frames: [fr(P.koumori, 'こうもり'), fr(P.handstand, 'ゆかに てを つく'), fr(land(-0.35, 1), 'ひざを はずす')],
          points: ['てを ゆかに ついてから ひざを はずす', 'ゆっくり {足|あし}を おろす'], drill: 'ひくい てつぼうで、マットの {上|うえ}で' },

        /* ===== 5・6年 鉄棒運動（はってん わざ） ===== */
        { id: 'sakaagari', grade: 'high', group: 'うしろに まわる', stars: 2, name: '{逆上|さかあ}がり',
          frames: [fr(P.kick, 'ふみこむ'), fr(P.kickUp, 'けりあげる', { arrow: 'ccw' }), fr(P.support, 'つばめ')],
          points: ['ふみこみ{足|あし}を てつぼうの {下|した}へ', 'けりあげ{足|あし}を {大|おお}きく ふり、うでを まげて おへそを ちかづける'], drill: '{補助逆上|ほじょさかあ}がりから' },
        { id: 'zenpoushiji', grade: 'high', group: 'まえに まわる', stars: 2, name: '{前方支持回転|ぜんぽうしじかいてん}',
          frames: [fr(P.support, 'むねを はる'), fr(rot(P.support, 150), '{大|おお}きく まえへ', { arrow: 'cw' }), fr(P.support, 'てくびを かえす')],
          points: ['からだを のばして {大|おお}きく まえへ', 'さいごに てくびを かえして {上|あ}がる'], drill: 'かかえ{込|こ}み{前回|まえまわ}りから' },
        { id: 'zenpoushinshitsu', grade: 'high', group: 'まえに まわる', stars: 3, name: '{前方伸膝支持回転|ぜんぽうしんしつしじかいてん}',
          frames: [fr(P.support, 'ひざを のばす'), fr(rot(P.support, 150), 'のばしたまま', { arrow: 'cw' }), fr(P.support, '{上|あ}がる')],
          points: ['ひざを のばしたまま まわる', 'てつぼうを ももで はさみこむ'], drill: '{前方支持回転|ぜんぽうしじかいてん}が 3かい つづけて できたら' },
        { id: 'kataashi', grade: 'high', group: 'おりる', stars: 2, name: '{片足踏|かたあしふ}み{越|こ}し{下|お}り',
          frames: [fr(P.support, 'つばめ'), fr(P.stepOn, '{足|あし}を のせる'), fr(land(1.0, 1), 'まえへ おりる')],
          points: ['かた{足|あし}を てつぼうに のせる', 'てで ささえながら ふみこして おりる'], drill: 'ひくい てつぼうで、せんせいと いっしょに' },
        { id: 'yokotobi', grade: 'high', group: 'おりる', stars: 3, name: '{横|よこ}とび{越|こ}し{下|お}り',
          frames: [fr(P.support, 'つばめ'), fr(P.sideVault, '{足|あし}を そろえて よこへ'), fr(land(1.05, 1), 'ふわっと')],
          points: ['りょう{足|あし}を そろえて よこへ ふる', 'てで おして てつぼうを とびこえる'], drill: '{片足踏|かたあしふ}み{越|こ}し{下|お}りから' },
        { id: 'hizaagari', grade: 'high', group: 'まえに まわる', stars: 2, name: '{膝掛|ひざか}け{上|あ}がり',
          frames: [fr(P.kneeHang, 'ひざを かける'), fr(rot(P.kneeHang, -45), '{大|おお}きく ふる', { arrow: 'ccw' }), fr(P.kneeSupport, 'てくびを かえす')],
          points: ['ふりを {大|おお}きく', 'てつぼうを おさえて、てくびを かえして {上|あ}がる'], drill: '{膝掛|ひざか}け{振|ふ}り{上|あ}がりから' },
        { id: 'momoagari', grade: 'high', group: 'まえに まわる', stars: 3, name: 'もも{掛|か}け{上|あ}がり',
          frames: [fr(P.kneeHang, 'ももを かける'), fr(rot(P.kneeHang, -45), '{大|おお}きく ふる', { arrow: 'ccw' }), fr(P.thighSupport, '{上|あ}がる')],
          points: ['ももの つけねで てつぼうに かける', 'ふりと てくびの かえしで {上|あ}がる'], drill: '{膝掛|ひざか}け{上|あ}がりから' },
        { id: 'zenpoumomo', grade: 'high', group: 'まえに まわる', stars: 3, name: '{前方|ぜんぽう}もも{掛|か}け{回転|かいてん}',
          frames: [fr(P.thighSupport, 'ももを かける'), fr(rot(P.thighSupport, 160), 'まえへ', { arrow: 'cw' }), fr(P.thighSupport, 'もどる')],
          points: ['ももの つけねで はさむ', 'むねを はって {大|おお}きく まえへ'], drill: '{前方片膝掛|ぜんぽうかたひざか}け{回転|かいてん}から' },
        { id: 'kouhoushiji', grade: 'high', group: 'うしろに まわる', stars: 2, name: '{後方支持回転|こうほうしじかいてん}',
          frames: [fr(P.support, '{足|あし}を ふる'), fr(rot(P.support, -150), 'うしろへ', { arrow: 'ccw' }), fr(P.support, 'つばめ')],
          points: ['{足|あし}を ふって いきおいを つける', 'おなかを てつぼうから はなさない'], drill: 'かかえ{込|こ}み{後|うし}ろ{回|まわ}りから' },
        { id: 'kouhoushinshitsu', grade: 'high', group: 'うしろに まわる', stars: 3, name: '{後方伸膝支持回転|こうほうしんしつしじかいてん}',
          frames: [fr(P.support, 'ひざを のばす'), fr(rot(P.support, -150), 'のばしたまま', { arrow: 'ccw' }), fr(P.support, 'つばめ')],
          points: ['ひざを のばしたまま まわる', 'かたを うしろへ {大|おお}きく たおす'], drill: '{後方支持回転|こうほうしじかいてん}が 3かい つづけて できたら' },
        { id: 'kouhoumomo', grade: 'high', group: 'うしろに まわる', stars: 3, name: '{後方|こうほう}もも{掛|か}け{回転|かいてん}',
          frames: [fr(P.thighSupport, 'ももを かける'), fr(rot(P.thighSupport, -160), 'うしろへ', { arrow: 'ccw' }), fr(P.thighSupport, 'もどる')],
          points: ['ももで しっかり はさむ', 'せなかを のばして うしろへ'], drill: '{後方片膝掛|こうほうかたひざか}け{回転|かいてん}から' },
        { id: 'shindouori', grade: 'high', group: 'おりる', stars: 3, name: '{両膝掛|りょうひざか}け{振動下|しんどうお}り（こうもり{振|ふ}り{下|お}り）',
          frames: [fr(P.koumori, 'こうもり'), fr(rot(P.koumori, -40), '{大|おお}きく ふる', { arrow: 'ccw' }), fr(land(-0.9, 1), 'ひざを はずす')],
          points: ['こうもりで {大|おお}きく ふる', 'まえに ふれた ときに ひざを はずして おりる'], drill: 'かならず せんせいと いっしょに。マットを しく' },
    ];

    const GRADES = {
        low: { label: '1・2{年|ねん}', title: 'てつぼう あそび', color: '#ef8a00' },
        mid: { label: '3・4{年|ねん}', title: '{鉄棒運動|てつぼううんどう}（きほんの わざ）', color: '#2f6fdc' },
        high: { label: '5・6{年|ねん}', title: '{鉄棒運動|てつぼううんどう}（はってん わざ）', color: '#8e5bd6' },
    };

    const SAFETY = ['てつぼうの {下|した}に マットを しく', 'まわりに {人|ひと}が いないか {見|み}る', 'じゅんばんを まもり、ふざけない', 'むずかしい わざは {先生|せんせい}と いっしょに'];

    /* ---------- え（SVG） ---------- */

    const f2 = n => (Math.round(n * 100) / 100).toString();
    const pt = q => `${f2(q[0])},${f2(q[1])}`;

    /** ぼう人間 1人 */
    function figure(p) {
        const line = (pts, cls) => `<polyline class="${cls}" points="${pts.filter(Boolean).map(pt).join(' ')}" />`;
        let s = '';
        if (p.k2 && p.f2) s += line([p.h, p.k2, p.f2], 'fg2');
        s += line([p.w, p.e, p.s], 'fg');
        s += line([p.s, p.h], 'fg body');
        s += line([p.h, p.k, p.f], 'fg');
        /* あたまは こし → かた の むきの さき */
        const hc = headOf(p);
        s += `<circle class="fhead" cx="${f2(hc[0])}" cy="${f2(hc[1])}" r="0.27" />`;
        return s;
    }

    /** まわる むきの やじるし（てつぼうの まわりの 円の 一部） */
    const AR = 1.2;
    function arrow(dir) {
        const cw = dir === 'cw';
        const a1 = rad(cw ? -115 : -65), a2 = rad(cw ? 25 : -205);
        const P1 = [AR * Math.cos(a1), AR * Math.sin(a1)], P2 = [AR * Math.cos(a2), AR * Math.sin(a2)];
        const t = cw ? [-Math.sin(a2), Math.cos(a2)] : [Math.sin(a2), -Math.cos(a2)];
        const n = [-t[1], t[0]], hl = 0.3, hw = 0.17;
        const tip = [P2[0] + t[0] * hl, P2[1] + t[1] * hl];
        const b1 = [P2[0] + n[0] * hw, P2[1] + n[1] * hw], b2 = [P2[0] - n[0] * hw, P2[1] - n[1] * hw];
        return `<path class="farr" d="M${pt(P1)} A${AR} ${AR} 0 0 ${cw ? 1 : 0} ${pt(P2)}" /><polygon class="farrh" points="${pt(tip)} ${pt(b1)} ${pt(b2)}" />`;
    }

    const headOf = p => {
        const dx = p.s[0] - p.h[0], dy = p.s[1] - p.h[1], L = Math.hypot(dx, dy) || 1;
        return [p.s[0] + dx / L * 0.4, p.s[1] + dy / L * 0.4];
    };
    const onGround = p => [p.f, p.f2, p.w].some(q => q && Math.abs(q[1] - 2.4) < 0.05);

    /** わざの コマ ぜんぶが はいる はんい（おなじ わざの コマは おなじ 大きさで かく） */
    function viewBoxOf(frames) {
        let x0 = -0.3, x1 = 0.3, y0 = -0.3, y1 = 0.3;
        const add = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
        for (const fm of frames) {
            for (const j of JOINTS) if (fm.p[j]) add(fm.p[j][0], fm.p[j][1], 0.1);
            const hc = headOf(fm.p); add(hc[0], hc[1], 0.3);
            if (fm.arrow) { add(-AR, -AR, 0.15); add(AR, AR * 0.6, 0.15); }
            if (onGround(fm.p) || fm.board) add(0, 2.45);
        }
        /* よこ:たて ＝ 4:5 ぐらいに そろえる */
        let w = x1 - x0 + 0.3, h = y1 - y0 + 0.3;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (w / h < 0.8) w = h * 0.8; else h = w / 0.8;
        return [cx - w / 2, cy - h / 2, w, h];
    }

    /** 1コマ（vb … viewBoxOf の けっか） */
    function frameSvg(fm, vb) {
        vb = vb || viewBoxOf([fm]);
        const [x, y, w, h] = vb;
        let s = `<svg class="tb-fig" viewBox="${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)}">`;
        const g = onGround(fm.p) || fm.board;
        s += `<line class="fpost" x1="0" y1="0" x2="0" y2="${g ? 2.4 : f2(y + h)}" />`;
        if (g) s += `<line class="fground" x1="${f2(x)}" y1="2.4" x2="${f2(x + w)}" y2="2.4" />`;
        if (fm.board) s += '<polygon class="fboard" points="-1.5,2.4 -0.05,2.4 -0.05,1.95" />';
        if (fm.arrow) s += arrow(fm.arrow);
        s += figure(fm.p);
        s += '<circle class="fbar" cx="0" cy="0" r="0.11" />';
        return s + '</svg>';
    }

    const api = { WAZA, GRADES, SAFETY, P, rot, mir, move, land, figure, frameSvg, viewBoxOf, JOINTS };
    root.PurintoTetsubou = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
