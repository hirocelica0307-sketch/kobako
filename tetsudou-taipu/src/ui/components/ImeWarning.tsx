export function ImeWarning() {
  return (
    <div className="overlay">
      <div className="warn-box">
        <div className="warn">⚠ ひらがな にゅうりょく に なっています</div>
        <div className="warn-body">
          <b>［半角/全角］</b>キーをおして<br />
          <b>えいすう（abc）</b>にきりかえてください
        </div>
        {/* 切り替えたら「何かキーを押せば戻る」と明記する。
            以前は戻り方が分からず、再読み込みさせてしまっていた。 */}
        <div className="warn-ok">きりかえたら なにかキーをおすと つづきから はじまります</div>
        <div className="keyhint">Chromebook は［かな/英数］キー</div>
        <div className="keyhint">Mac は［英数］キー、または Ctrl+Space</div>
      </div>
    </div>
  );
}
