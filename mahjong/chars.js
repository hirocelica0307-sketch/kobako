/* キャラクター（自分で えらぶ・コンピューターにも つかう）
   ------------------------------------------------------------------
   絵は Microsoft Fluent Emoji「3D」の 動物（MIT）。assets/chars/ に 保存（くわしくは assets/README.txt）。
   柴犬は Fluent Emoji の「Dog」（茶色で しっぽが まいた 全身の 犬）を つかう。
   ------------------------------------------------------------------ */
export const CHARS = [
    { id: 'shiba', name: '柴犬' },
    { id: 'cat', name: 'ねこ' },
    { id: 'fox', name: 'きつね' },
    { id: 'rabbit', name: 'うさぎ' },
    { id: 'panda', name: 'パンダ' },
    { id: 'bear', name: 'くま' },
    { id: 'tiger', name: 'とら' },
    { id: 'hamster', name: 'ハムスター' },
    { id: 'monkey', name: 'さる' },
    { id: 'frog', name: 'かえる' },
    { id: 'penguin', name: 'ペンギン' },
    { id: 'koala', name: 'コアラ' },
    { id: 'lion', name: 'ライオン' },
    { id: 'mouse', name: 'ねずみ' },
    { id: 'owl', name: 'ふくろう' },
    { id: 'dog', name: 'いぬ' }
];

export const charById = id => CHARS.find(c => c.id === id) || CHARS[0];
export const charImg = id => `assets/chars/${charById(id).id}.webp`;
