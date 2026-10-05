interface Props {
  /** 漢字などの本体。 */
  children: string;
  /** ふりがな。 */
  kana: string;
}

/**
 * ふりがな付きの文字。
 * 小学生が一人で遊べるように、画面の案内文には必ず読みを添える。
 */
export function Furigana({ children, kana }: Props) {
  return (
    <ruby className="fg">
      {children}
      <rp>（</rp>
      <rt>{kana}</rt>
      <rp>）</rp>
    </ruby>
  );
}
