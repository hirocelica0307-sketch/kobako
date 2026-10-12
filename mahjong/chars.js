/* キャラクター（自分で えらぶ・コンピューターにも つかう）
   ------------------------------------------------------------------
   どうぶつ：Microsoft Fluent Emoji「3D」の 動物（MIT）。assets/chars/
             柴犬は Fluent Emoji の「Dog」（茶色で しっぽが まいた 全身の 犬）を つかう。
   ひと    ：DiceBear「Notionists」（CC0）。まえの 版の 人の アバター。assets/avatars/
   くわしくは assets/README.txt。
   ------------------------------------------------------------------ */
export const CHARS = [
    { id: 'shiba', name: '柴犬', group: 'animal' },
    { id: 'cat', name: 'ねこ', group: 'animal' },
    { id: 'fox', name: 'きつね', group: 'animal' },
    { id: 'rabbit', name: 'うさぎ', group: 'animal' },
    { id: 'panda', name: 'パンダ', group: 'animal' },
    { id: 'bear', name: 'くま', group: 'animal' },
    { id: 'tiger', name: 'とら', group: 'animal' },
    { id: 'hamster', name: 'ハムスター', group: 'animal' },
    { id: 'monkey', name: 'さる', group: 'animal' },
    { id: 'frog', name: 'かえる', group: 'animal' },
    { id: 'penguin', name: 'ペンギン', group: 'animal' },
    { id: 'koala', name: 'コアラ', group: 'animal' },
    { id: 'lion', name: 'ライオン', group: 'animal' },
    { id: 'mouse', name: 'ねずみ', group: 'animal' },
    { id: 'owl', name: 'ふくろう', group: 'animal' },
    { id: 'dog', name: 'いぬ', group: 'animal' },
    // ひと（まえの 版の アバター。名まえは 仮の 名まえ）
    { id: 'p-you', name: 'アオ', group: 'human', file: 'you' },
    { id: 'p-friend', name: 'ユウ', group: 'human', file: 'friend' },
    { id: 'p-cpu1', name: 'ハル', group: 'human', file: 'cpu1' },
    { id: 'p-cpu2', name: 'ミオ', group: 'human', file: 'cpu2' },
    { id: 'p-cpu3', name: 'ソラ', group: 'human', file: 'cpu3' },
    { id: 'p-cpu4', name: 'ジン', group: 'human', file: 'cpu4' },
    { id: 'p-cpu5', name: 'リン', group: 'human', file: 'cpu5' },
    { id: 'p-cpu6', name: 'ケイ', group: 'human', file: 'cpu6' }
];

export const GROUPS = [
    { id: 'animal', name: 'どうぶつ' },
    { id: 'human', name: 'ひと' }
];

export const charById = id => CHARS.find(c => c.id === id) || CHARS[0];
export const charImg = id => {
    const c = charById(id);
    return c.group === 'human' ? `assets/avatars/${c.file}.svg` : `assets/chars/${c.id}.webp`;
};
