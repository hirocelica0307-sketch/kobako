'use strict';
/* =========================================================
   先生（学校）が つくった カードを 白黒の ぬりえに した もの
   - 元の カードから 色・記入例・手書きの 文字を けし、
     イラストと わくは そのまま 線画（assets/cards/*.svg）に
   ========================================================= */
const TEACHER_CARDS = {
  jiko: [
    { grade: 'high', file: 'jiko-onpu', name: '自己紹介カード（音ぷ）' },
    { grade: 'low', file: 'jiko-nigaoe', name: 'にがおえ じこしょうかい' },
    { grade: 'low', file: 'jiko-fuusen', name: 'ふうせん' },
    { grade: 'high', file: 'jiko-uchu', name: 'うちゅうひこうし' },
    { grade: 'high', file: 'jiko-iruka', name: 'イルカ' },
    { grade: 'high', file: 'jiko-umi', name: '海の MY PROFILE' },
  ],
  g1: [
    { grade: 'high', file: 'g1-kikyu', name: 'ききゅうの 目標カード' },
  ],
  g2: [
    { grade: 'high', file: 'g2-kaidan', name: 'かいだんを かける 子' },
    { grade: 'high', file: 'g2-manga', name: 'マンガ版 目標カード' },
  ],
  undo: [
    { grade: 'low', file: 'undo-taiso', name: 'たいそうふくの 子' },
    { grade: 'low', file: 'undo-mokuhyou', name: 'うんどう会 もくひょうカード' },
  ],
  ganbari: [
    { grade: 'low', file: 'ganbari-hana', name: 'お花の がんばりカード' },
  ],
  kakari: [
    { grade: 'low', file: 'kakari-komakko', name: '係だっ！' },
  ],
};

const teacherSrc = file => `assets/cards/${file}.svg`;

for (const [cat, list] of Object.entries(TEACHER_CARDS)) {
  addDesigns(cat, list.map(t => ({
    ...t,
    teacher: true,
    name: `${t.name}（先生の カード）`,
    draw: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm">
  <rect width="210" height="297" fill="#fff"/>
  <image href="${teacherSrc(t.file)}" x="6" y="6" width="198" height="285" preserveAspectRatio="xMidYMid meet"/>
</svg>`,
  })));
}
