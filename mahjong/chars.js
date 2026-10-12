/* キャラクター（自分で えらぶ・コンピューターにも つかう）
   ------------------------------------------------------------------
   どうぶつ：十二支。Microsoft Fluent Emoji「3D」の 動物（MIT）。assets/chars/
             いぬ（柴犬）は Fluent Emoji の「Dog」（茶色で しっぽが まいた 全身の 犬）を つかう。
   ひと    ：DiceBear「Notionists」（CC0）。まえの 版の 人の アバター。assets/avatars/
   くわしくは assets/README.txt。
   ------------------------------------------------------------------ */
export const CHARS = [
    // 十二支（ねずみ → いのしし の じゅん）。いぬは 柴犬
    { id: 'mouse', name: 'ねずみ', group: 'animal' },
    { id: 'cow', name: 'うし', group: 'animal' },
    { id: 'tiger', name: 'とら', group: 'animal' },
    { id: 'rabbit', name: 'うさぎ', group: 'animal' },
    { id: 'dragon', name: 'たつ', group: 'animal' },
    { id: 'snake', name: 'へび', group: 'animal' },
    { id: 'horse', name: 'うま', group: 'animal' },
    { id: 'sheep', name: 'ひつじ', group: 'animal' },
    { id: 'monkey', name: 'さる', group: 'animal' },
    { id: 'chicken', name: 'とり', group: 'animal' },
    { id: 'shiba', name: '柴犬', group: 'animal' },
    { id: 'boar', name: 'いのしし', group: 'animal' },
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
    { id: 'animal', name: 'どうぶつ（十二支）' },
    { id: 'human', name: 'ひと' }
];

export const charById = id => CHARS.find(c => c.id === id) || CHARS[0];
export const charImg = id => {
    const c = charById(id);
    return c.group === 'human' ? `assets/avatars/${c.file}.svg` : `assets/chars/${c.id}.webp`;
};
