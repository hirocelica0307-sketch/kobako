/* かりの 譜面（うごきの たしかめ よう。録音を しらべたら かきかえる） */
(function (G) {
    const beats = [];
    for (let i = 0; i < 300; i++) beats.push(0.5 + i * 60 / 160);
    G.SONG_TENGOKU = {
        duration: 107,
        beats,
        leadBeats: 2,
        scenes: [
            { strokes: [
                { k: 'zigzag', b: [0, 8], per: 1, c: 'orange', x0: 260, y0: 260, x1: 1340, y1: 260, amp: 70 },
                { k: 'loops', b: [8, 16], per: 1, c: 'lavender', x0: 260, y0: 520, x1: 1340, y1: 520, r: 70 }
            ] },
            { strokes: [
                { k: 'arc', b: [16, 20], c: 'lime', x0: 200, y0: 700, x1: 760, y1: 700, bend: 420 },
                { k: 'arc', b: [20, 24], c: 'lime', x0: 840, y0: 700, x1: 1400, y1: 700, bend: 420 },
                { k: 'wave', b: [24, 32], per: 1, c: 'cyan', x0: 300, y0: 220, x1: 1300, y1: 220, amp: 50 }
            ] },
            { strokes: [
                { k: 'spiral', b: [32, 40], c: 'purple', cx: 500, cy: 450, r0: 300, r1: 30, turns: 3 },
                { k: 'hops', b: [40, 48], per: 1, c: 'pink', x0: 900, y0: 600, x1: 1450, y1: 600, h: 160 },
                { k: 'pop', b: [48, 48], c: 'yellow', x: 1170, y: 250 }
            ] }
        ]
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
