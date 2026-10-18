/* 毎日教養 ── ジャンルの 一覧と、問題ファイルの 受け口
   問題ファイル（data/<ジャンル>.js）は MKData.add('ジャンル', [ ... ]) で 問題を 入れる。
   1問の 形：
     [ 'テーマ',                     ← 1問ごとに ちがう 見出し（id は「ジャンル/テーマ」になる。同じテーマは 2つ 置かない）
       '問題文',
       ['正解', 'まちがい1', 'まちがい2', 'まちがい3'],   ← 正解は いつも 先頭に 書く（画面では 毎回 ならびかえる）
       'なぜ？（くわしい 解説）',
       ['まちがい1の 説明', 'まちがい2の 説明', 'まちがい3の 説明'],
       'ワンポイント' ] */
(function (root) {
    'use strict';
    const GENRES = [
        { id: 'seiji',     name: '政治・法律',           short: '政治',     color: '#3f6fb5' },
        { id: 'keizai',    name: '経済・お金',           short: '経済',     color: '#c08a12' },
        { id: 'business',  name: 'ビジネス・経営',       short: 'ビジネス', color: '#8a5a3c' },
        { id: 'chiri',     name: '国際・地理',           short: '地理',     color: '#2e8b6e' },
        { id: 'nihonshi',  name: '日本史',               short: '日本史',   color: '#c0473a' },
        { id: 'sekaishi',  name: '世界史',               short: '世界史',   color: '#7b6a58' },
        { id: 'tetsugaku', name: '哲学・思想',           short: '哲学',     color: '#c27b12' },
        { id: 'shukyo',    name: '宗教・神話',           short: '宗教',     color: '#b8432f' },
        { id: 'shinri',    name: '心理学・行動経済学',   short: '心理',     color: '#c2508a' },
        { id: 'bungaku',   name: '文学',                 short: '文学',     color: '#3f8a4a' },
        { id: 'bijutsu',   name: '美術・建築',           short: '美術',     color: '#d0663a' },
        { id: 'ongaku',    name: '音楽',                 short: '音楽',     color: '#4a4f7a' },
        { id: 'geinou',    name: '芸能・映画・伝統芸能', short: '芸能',     color: '#2f86b8' },
        { id: 'sports',    name: 'スポーツ',             short: 'スポーツ', color: '#b5862a' },
        { id: 'kagaku',    name: '科学・宇宙',           short: '科学',     color: '#d06a2a' },
        { id: 'seibutsu',  name: '生物・医学・健康',     short: '生物',     color: '#c03a5a' },
        { id: 'it',        name: 'IT・テクノロジー',     short: 'IT',       color: '#2a8fb0' },
        { id: 'suugaku',   name: '数学・統計・論理',     short: '数学',     color: '#d04a4a' },
        { id: 'kotoba',    name: 'ことば',               short: 'ことば',   color: '#3a6ab0' },
        { id: 'kurashi',   name: '食・暮らし・マナー',   short: '暮らし',   color: '#5a7a2a' }
    ];
    const rows = {};
    GENRES.forEach(function (g) { rows[g.id] = []; });
    function add(genre, list) {
        if (!rows[genre]) throw new Error('ジャンルが ない: ' + genre);
        rows[genre].push.apply(rows[genre], list);
    }
    root.MKData = { GENRES: GENRES, rows: rows, add: add };
})(typeof window !== 'undefined' ? window : globalThis);
