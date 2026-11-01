import { useState, useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

type RepeatMode = "off" | "all" | "one";
type Theme = "david" | "lucy";

const SEP = "\x1f";
const SEGMENTS = 40;
const NEXT_REPEAT : Record<RepeatMode,RepeatMode> = { off: "all", all: "one", one: "off" };
const REPEAT_LABEL : Record<RepeatMode,string> = { off: "リピートなし", all: "全曲リピート", one: "1曲リピート" };
const THEME_LABEL: Record<Theme, string> = { david: "DAVID", lucy: "LUCY" };
const THEME_KEY = "neon-track:theme";

type Track = {
	state : string,
	name : string,
	artist : string,
	album : string,
	duration : number,
	position : number,
	id : string,
	repeat : RepeatMode,
}

type HudProps = {
	track : Track,
	artwork : string | null,
	theme : Theme,
	onToggleTheme :() => void,
	onCommand: (action : MusicAction) => void
};

type MusicAction = "playpause" | "next" | "previous" | `repeat_${RepeatMode}`;

// 保存されている値が正しいテーマ名か確認する型ガード
const isTheme = (v: string | null): v is Theme => v === "david" || v === "lucy";

// 保存テーマの読み込み
const loadTheme = () :Theme => {
	try{
		const saved = localStorage.getItem(THEME_KEY);
		return isTheme(saved) ? saved : "david";
	} catch {
		return "david";
	}
}

const parse = (output :string) : Track | null => {
	const raw = (output || "").trim();
	if (!raw || raw === "stopped") return null;
	const [state, name, artist, album, duration, position, id, repeat] = raw.split(SEP);
	const isRepeatMode = (v :string) : v is RepeatMode =>
		v === "off" || v === "all" || v === "one";
	return {
		state,
		name,
		artist,
		album,
		duration: Number(duration) || 0,
		position: Number(position) || 0,
		id,
		repeat: isRepeatMode(repeat) ? repeat : "off",
	};
};

const fmt = (sec : number) => {
	const s = Math.max(0, Math.floor(sec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Icon = {
	prev: (
		<svg viewBox="0 0 24 24"><path d="M5 5h2.5v14H5zM20 5v14L9 12z" /></svg>
	),
	next: (
		<svg viewBox="0 0 24 24"><path d="M16.5 5H19v14h-2.5zM4 5v14l11-7z" /></svg>
	),
	play: (
		<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z" /></svg>
	),
	pause: (
		<svg viewBox="0 0 24 24"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /></svg>
	),
	repeat: (
		<svg viewBox="0 0 24 24" className="stroke">
			<path d="M4 12V9.5A3.5 3.5 0 0 1 7.5 6H18M15 3l3 3-3 3M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H6M9 21l-3-3 3-3" />
		</svg>
	),
};

type IdleProps = { message : string, theme : Theme };

const Idle = ({message, theme} : IdleProps) => (
  <div className="erh" data-theme={theme}>
    <div className="erh-frame">
      <div className="erh-panel erh-idle">{message}</div>
    </div>
  </div>
);

const handleMouseDown = (e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest("button,a,input")){
			return;
		}
		getCurrentWindow().startDragging();
};

export default function App(){
	const [track, setTrack] = useState<Track | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [artwork, setArtwork] = useState<string | null>(null);
	const [theme, setTheme] = useState<Theme>(loadTheme);

	// テーマの描画
	useEffect(() => {
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch {
		}
	},[theme])

	const toggleTheme = () => {
		setTheme(t => t === "david" ? "lucy" : "david");
	}

	// 曲情報の描画（問い合わせ→取り直し）
	const refresh = useCallback(async () => {
		try {
			const output = await invoke<string>("now_playing");
			setTrack(parse(output));
			setError(null);
		} catch (e) {
			setError(String(e));
		}
	},[]);

	//1秒ごとのポーリング
	useEffect (() => {
		refresh();
		const id = setInterval(refresh,1000);
		return () => clearInterval(id);
	},[refresh])

	const hadleCommand = async (action : MusicAction) => {
		try {
			await invoke("music_command",{ action });
		} catch (e){
			console.error(e);
		}	
		refresh();
	}

	// アートワーク情報の描画
	const trackId = track?.id;
	useEffect(() => {
		if (!trackId) return;
		invoke<string | null>("artwork").then(setArtwork).catch(console.error);
	},[trackId]);
	
	if (error) return <Idle message = {`エラー:${error}`} theme={theme}/>
	if (!track) return <Idle message ="ミュージックで曲を再生すると、ここに表示されます" theme={theme}/>;
	return (
	<Hud 
	track={track}
	artwork={artwork}
	onToggleTheme={toggleTheme}
	theme={theme}
	onCommand={hadleCommand}/>
	)
}

const Hud = ({track : t, artwork, theme, onToggleTheme, onCommand } : HudProps) => {
	const playing = t.state === "playing";
	const ratio = t.duration > 0 ? Math.min(t.position / t.duration, 1) : 0;
  const filled = Math.round(ratio * SEGMENTS);

  return (
		
    <div className={`erh ${playing ? "is-playing" : "is-paused"}`} data-theme={theme} onMouseDown={handleMouseDown}>
      <div className="erh-frame">
        <div className="erh-panel">
          <div className="erh-art">
            <div className="erh-art-inner">
              {artwork ? (
                <img src={artwork} />
              ) : (
                <div className="erh-art-empty">アートワークなし</div>
              )}
            </div>
          </div>

          <div className="erh-info">
            <div className="erh-status">{playing ? "再生中" : "一時停止中"}</div>
						<button className="erh-theme" title="テーマを切り替え" onClick={onToggleTheme} >
                <span className="erh-theme-dot" />
                {THEME_LABEL[theme]}
              </button>

            {/* key に曲IDを渡し、曲が変わるたびにグリッチを再生させる */}
            <div className="erh-title" key={t.id} data-text={t.name}>{t.name}</div>
            <div className="erh-artist">{t.artist}</div>
            <div className="erh-album">{t.album}</div>

            <div className="erh-bar">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div
                  key={i}
                  className={`erh-seg${i < filled - 1 ? " on" : ""}${i === filled - 1 ? " head" : ""}`}
                />
              ))}
            </div>
            <div className="erh-time">
              <span>{fmt(t.position)}</span>
              <span>{t.duration ? fmt(t.duration) : "--:--"}</span>
            </div>

            <div className="erh-ctrl">
              <button className="erh-btn" title="前の曲" onClick={() => onCommand("previous")}>
                {Icon.prev}
              </button>
              <button className="erh-btn main" title={playing ? "一時停止" : "再生"} onClick={() => onCommand("playpause")}>
                {playing ? Icon.pause : Icon.play}
              </button>
              <button className="erh-btn" title="次の曲" onClick={() => onCommand("next")}>
                {Icon.next}
              </button>
              <button
                className={`erh-btn repeat${t.repeat !== "off" ? " active" : ""}`}
                title="クリックで切り替え"
                onClick={() => onCommand(`repeat_${NEXT_REPEAT[t.repeat]}`)}
              >
                {Icon.repeat}
                {REPEAT_LABEL[t.repeat] || REPEAT_LABEL.off}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
