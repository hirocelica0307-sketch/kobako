/* 花札 48枚の データ
   ------------------------------------------------------------------
   id は 0〜47。月（1〜12）ごとに 4枚ずつ、id = (月-1)*4 + 0〜3 の 順です。
   種類（k）は 4つ：
     hikari … 光（ひかり）   5枚  いちばん 強い 札
     tane   … たね           9枚  動物や 道具の 札
     tan    … 短冊（たん）   10枚 細長い 紙の 札
     kasu   … かす           24枚 植物だけの 札
   tag は 役に つかう しるしです。
   ------------------------------------------------------------------ */

export const KIND_NAME = { hikari: '光', tane: 'たね', tan: '短冊', kasu: 'かす' };
export const KIND_ORDER = ['hikari', 'tane', 'tan', 'kasu'];

export const MONTHS = [
    null,
    { flower: '松',   yomi: 'まつ',   old: '睦月', color: '#2f7a3a' },
    { flower: '梅',   yomi: 'うめ',   old: '如月', color: '#c8283c' },
    { flower: '桜',   yomi: 'さくら', old: '弥生', color: '#e889a6' },
    { flower: '藤',   yomi: 'ふじ',   old: '卯月', color: '#7d5cb8' },
    { flower: '菖蒲', yomi: 'あやめ', old: '皐月', color: '#4a5fc0' },
    { flower: '牡丹', yomi: 'ぼたん', old: '水無月', color: '#d2335a' },
    { flower: '萩',   yomi: 'はぎ',   old: '文月', color: '#b8433a' },
    { flower: '芒',   yomi: 'すすき', old: '葉月', color: '#8a7a4a' },
    { flower: '菊',   yomi: 'きく',   old: '長月', color: '#d9a21b' },
    { flower: '紅葉', yomi: 'もみじ', old: '神無月', color: '#d0451f' },
    { flower: '柳',   yomi: 'やなぎ', old: '霜月', color: '#5f8f3a' },
    { flower: '桐',   yomi: 'きり',   old: '師走', color: '#6b5aa0' }
];

const RAW = [
    // 1月 松
    ['hikari', '松に鶴', 'まつに つる', ['tsuru']],
    ['tan', '松に赤短', 'まつに あかたん', ['akatan']],
    ['kasu', '松のかす', 'まつの かす'],
    ['kasu', '松のかす', 'まつの かす'],
    // 2月 梅
    ['tane', '梅に鶯', 'うめに うぐいす', ['uguisu']],
    ['tan', '梅に赤短', 'うめに あかたん', ['akatan']],
    ['kasu', '梅のかす', 'うめの かす'],
    ['kasu', '梅のかす', 'うめの かす'],
    // 3月 桜
    ['hikari', '桜に幕', 'さくらに まく', ['maku']],
    ['tan', '桜に赤短', 'さくらに あかたん', ['akatan']],
    ['kasu', '桜のかす', 'さくらの かす'],
    ['kasu', '桜のかす', 'さくらの かす'],
    // 4月 藤
    ['tane', '藤に不如帰', 'ふじに ほととぎす', ['hototogisu']],
    ['tan', '藤に短冊', 'ふじに たんざく', ['plain']],
    ['kasu', '藤のかす', 'ふじの かす'],
    ['kasu', '藤のかす', 'ふじの かす'],
    // 5月 菖蒲
    ['tane', '菖蒲に八橋', 'あやめに やつはし', ['hashi']],
    ['tan', '菖蒲に短冊', 'あやめに たんざく', ['plain']],
    ['kasu', '菖蒲のかす', 'あやめの かす'],
    ['kasu', '菖蒲のかす', 'あやめの かす'],
    // 6月 牡丹
    ['tane', '牡丹に蝶', 'ぼたんに ちょう', ['cho']],
    ['tan', '牡丹に青短', 'ぼたんに あおたん', ['aotan']],
    ['kasu', '牡丹のかす', 'ぼたんの かす'],
    ['kasu', '牡丹のかす', 'ぼたんの かす'],
    // 7月 萩
    ['tane', '萩に猪', 'はぎに いのしし', ['ino']],
    ['tan', '萩に短冊', 'はぎに たんざく', ['plain']],
    ['kasu', '萩のかす', 'はぎの かす'],
    ['kasu', '萩のかす', 'はぎの かす'],
    // 8月 芒
    ['hikari', '芒に月', 'すすきに つき', ['tsuki']],
    ['tane', '芒に雁', 'すすきに かり', ['kari']],
    ['kasu', '芒のかす', 'すすきの かす'],
    ['kasu', '芒のかす', 'すすきの かす'],
    // 9月 菊
    ['tane', '菊に盃', 'きくに さかずき', ['sake']],
    ['tan', '菊に青短', 'きくに あおたん', ['aotan']],
    ['kasu', '菊のかす', 'きくの かす'],
    ['kasu', '菊のかす', 'きくの かす'],
    // 10月 紅葉
    ['tane', '紅葉に鹿', 'もみじに しか', ['shika']],
    ['tan', '紅葉に青短', 'もみじに あおたん', ['aotan']],
    ['kasu', '紅葉のかす', 'もみじの かす'],
    ['kasu', '紅葉のかす', 'もみじの かす'],
    // 11月 柳
    ['hikari', '柳に小野道風', 'やなぎに おののとうふう（雨）', ['ame']],
    ['tane', '柳に燕', 'やなぎに つばめ', ['tsubame']],
    ['tan', '柳に短冊', 'やなぎに たんざく', ['plain']],
    ['kasu', '柳に雷', 'やなぎに かみなり', ['kaminari']],
    // 12月 桐
    ['hikari', '桐に鳳凰', 'きりに ほうおう', ['houou']],
    ['kasu', '桐のかす', 'きりの かす'],
    ['kasu', '桐のかす', 'きりの かす'],
    ['kasu', '桐のかす（色ちがい）', 'きりの かす', ['kiri-yellow']]
];

export const CARDS = RAW.map(([k, name, yomi, tags], id) => ({
    id,
    m: Math.floor(id / 4) + 1,
    k,
    name,
    yomi,
    tags: tags || []
}));

export const monthOf = id => Math.floor(id / 4) + 1;
export const kindOf = id => CARDS[id].k;
export const hasTag = (id, tag) => CARDS[id].tags.includes(tag);
export const idByTag = tag => CARDS.find(c => c.tags.includes(tag)).id;

/** 札の 短い せつめい（「1月 松・光」など） */
export function cardLabel(id) {
    const c = CARDS[id];
    return `${c.m}月 ${MONTHS[c.m].flower}・${KIND_NAME[c.k]}`;
}
