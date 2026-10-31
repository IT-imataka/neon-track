-- Music.app の再生情報を区切り文字(ASCII 31)つなぎで返す。
-- 引数1: アートワークの書き出し先パス
-- 引数2: 前回の曲ID(変わったときだけアートワークを書き出す)
-- 出力: state, name, artist, album, duration秒, position秒, id, repeat, artFlag
--   artFlag = "same"(曲が同じ) / "1"(書き出した) / "0"(アートワークなし)

on run argv
	set artPath to item 1 of argv
	set lastId to item 2 of argv
	set US to character id 31

	if application "Music" is not running then return "stopped"

	try
		tell application "Music"
			set playerState to player state as string
			if playerState is "stopped" then return "stopped"

			set t to current track
			set nm to name of t
			set ar to artist of t
			set al to album of t

			set du to 0
			try
				set du to (duration of t) as integer
			end try
			set pos to 0
			try
				set pos to (player position) as integer
			end try

			try
				set pid to persistent ID of t
			on error
				set pid to nm & "/" & ar
			end try

			set rp to song repeat as string

			set rawArt to missing value
			if pid is not lastId then
				try
					set rawArt to raw data of artwork 1 of t
				end try
			end if
		end tell
	on error
		return "stopped"
	end try

	-- ファイル書き込みは tell の外で行う(権限エラー回避)
	set artFlag to "same"
	if pid is not lastId then
		if rawArt is missing value then
			set artFlag to "0"
		else
			try
				set f to open for access (POSIX file artPath) with write permission
				set eof f to 0
				write rawArt to f
				close access f
				set artFlag to "1"
			on error
				try
					close access (POSIX file artPath)
				end try
				set artFlag to "0"
			end try
		end if
	end if

	return playerState & US & nm & US & ar & US & al & US & du & US & pos & US & pid & US & rp & US & artFlag
end run
