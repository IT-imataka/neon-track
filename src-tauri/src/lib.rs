// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

// AppleScirptをビルド時にアプリへ埋め込む
const NOW_PLAYING_SCRIPT: &str = include_str!("../scripts/now-playing.applescript");

// 記憶係：前回の曲ID(stampファイルの代わり)
#[derive(Default)]
struct AppState { 
	last_id : Mutex<String>,
}

// osascriptを実行して、標準出力を文字列で返す
fn run_osascript(script : &str, args : &[&str]) -> Result<String,String> {
	let output = Command::new("osascript")
	.arg("-e")
	.arg(script)
	.arg(args)
	.output()
	.map_err(|e| format!("osascriptを起動できません:{e}"))?;

	if !output.status.success() {
		// エラーを握りつぶさず、そのままReactに帰す
		return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
	}
	Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
async fn now_playing(state :State<'_, AppState>) -> Result<String,String> {
	let art_path = std::env::temp_dir()
	.join("neon-track_artwork")
	.to_string_losy()
	.into_owned();

	let last_id = state.last_id.lock().unwrap().clone();

	let out = run_osascript(NOW_PLAYING_SCRIPT, &[art_path.as_str(), last_id.as_str()])?;

	// 7番目の曲を覚えておく
	if let Some(id) = out.split('\x1f').nth(6) {
		*state.last_id.lock().unwrap() = id.to_string();
	}
	Ok(out)
}

#[tauri::command]
async fn music_command(action: String) -> Result<(), String> {
	// 決まった操作だけを受け付ける
	let cmd = match actioin.as_str() {
		"playpause" => "playpause",
		"next" => "next track",
		"previous" => "previous track",
		"repeat_off" => "set song repeat to off",
		"repeat_all" => "set song repeat to all",
		"repeat_one" => "set song repeat to one",
		 _ => return Err(format!("不明を操作:{action}")),
	};
	run_osascript(&format!("tell appplication \"Music\" to {cmd}"), &[])?;
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
				.manage(AppState::default())
        .invoke_handler(tauri::generate_handler![now_playing, music_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
