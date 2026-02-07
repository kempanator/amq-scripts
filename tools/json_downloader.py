"""
Download audio or video files from JSON files
Version 0.7

Instructions:
1. Put song list JSONs inside the "json" folder
2. Run this script
3. Downloaded songs will appear in "audio" and "video" folders

Supported file formats:
1. anisongdb JSON
2. official AMQ song history export
3. joseph song list script export
4. blissfulyoshi ranked song list
5. csl song list
"""

import os
import json
import subprocess
import urllib.request

# Ensure eyed3 is available
try:
    import eyed3
except ModuleNotFoundError:
    subprocess.run(["python", "-m", "pip", "install", "-U", "eyed3"], check=True)
    import eyed3


# --- CONFIGURATION ---
MODE = "both"  # "audio", "video", "both"
HOST = 1
HOSTS = {
    1: "eudist.animemusicquiz.com",
    2: "nawdist.animemusicquiz.com",
    3: "naedist.animemusicquiz.com",
}
BASE_PATH = ""  # optional custom path
JSON_PATH = os.path.join(BASE_PATH, "json")
AUDIO_PATH = os.path.join(BASE_PATH, "audio")
VIDEO_PATH = os.path.join(BASE_PATH, "video")


# --- UTILITIES ---
def extract_data(obj: dict, possible_keys: list[str]):
    """Try multiple keys (supports dot notation) and return first match."""
    for key in possible_keys:
        if "." in key:
            temp = obj
            for k in key.split("."):
                if isinstance(temp, dict) and k in temp:
                    temp = temp[k]
                else:
                    break
            else:
                return temp
        elif key in obj:
            return obj[key]
    return None


def convert_url(url: str):
    """Convert relative URL to full host URL."""
    if not url:
        return None
    if url.startswith("http"):
        return url
    return f"https://{HOSTS[HOST]}/{url}"


def sanitize_filename(name: str):
    """Remove forbidden characters from filenames."""
    for char in "<>:\"/\\|?*":
        name = name.replace(char, "")
    return name.strip()


def shorten_type(text: str):
    """Shorten song type text to OP/ED/IN."""
    if not text:
        return None
    if text.startswith("O"):
        return f"OP{text.split()[1]}"
    if text.startswith("E"):
        return f"ED{text.split()[1]}"
    if text.startswith("I"):
        return "IN"
    return text


# --- SONG CLASS ---
class Song:
    def __init__(self, data: dict):
        self.animeRomajiName = extract_data(data, ["animeRomajiName", "animeJPName", "songInfo.animeNames.romaji", "anime.romaji", "animeRomaji"])
        self.animeEnglishName = extract_data(data, ["animeEnglishName", "animeENName", "songInfo.animeNames.english", "anime.english", "animeEnglish"])
        self.songArtist = extract_data(data, ["songArtist", "artist", "songInfo.artist"])
        self.songName = extract_data(data, ["songName", "name", "songInfo.songName"])
        self.songType = self._extract_type(data)
        self.songDifficulty = self._extract_difficulty(data)
        self.animeType = extract_data(data, ["animeType", "songInfo.animeType"])
        self.animeVintage = extract_data(data, ["animeVintage", "songInfo.vintage", "vintage"])
        self.audio = self._extract_media(data, ["audio", "videoUrl", "urls.catbox.0", "LinkMp3"], ".mp3")
        self.video480 = self._extract_media(data, ["video480", "MQ", "videoUrl", "urls.catbox.480"], ".webm")
        self.video720 = self._extract_media(data, ["video720", "HQ", "videoUrl", "urls.catbox.720", "LinkVideo"], ".webm")

    def _extract_type(self, data: dict):
        raw_type = extract_data(data, ["songType", "type", "songInfo.type"])
        if isinstance(raw_type, int):
            type_dict = {1: "Opening", 2: "Ending", 3: "Insert Song"}
            number = extract_data(data, ["songTypeNumber", "songInfo.typeNumber"])
            text = type_dict.get(raw_type)
            return f"{text} {number}" if text and number else text
        return raw_type

    def _extract_difficulty(self, data: dict):
        dif = extract_data(data, ["songDifficulty", "songInfo.animeDifficulty", "songInfo.songName"])
        try:
            return float(dif)
        except (TypeError, ValueError):
            return None

    def _extract_media(self, data: dict, keys: list[str], suffix: str):
        link = extract_data(data, keys)
        if isinstance(link, str) and link.endswith(suffix):
            return convert_url(link)
        return None

    def has_valid_link(self):
        return any(link and link.strip() for link in [self.audio, self.video480, self.video720])

    def __str__(self):
        return f"0:{self.audio}, 480:{self.video480}, 720:{self.video720}"


# --- DOWNLOADERS ---
def download_audio(song: Song):
    os.makedirs(AUDIO_PATH, exist_ok=True)
    if not song.audio:
        print(f"Missing audio: {song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)}")
        return

    filename = song.audio.split("/")[-1]
    filepath = os.path.join(AUDIO_PATH, filename)
    if os.path.isfile(filepath):
        return

    try:
        print(f"Downloading {filename}")
        urllib.request.urlretrieve(song.audio, filepath)

        eyed3.log.setLevel("ERROR")
        id3 = eyed3.load(filepath)
        id3.initTag()
        id3.tag.artist = song.songArtist or ""
        id3.tag.title = song.songName or ""
        id3.tag.genre = song.songType or ""
        id3.tag.album = song.animeEnglishName or song.animeRomajiName or ""
        id3.tag.save()
    except Exception as e:
        print(f"Error downloading {filename}: {e}")


def download_video(song: Song):
    os.makedirs(VIDEO_PATH, exist_ok=True)
    link = song.video720 or song.video480
    if not (link and link.startswith("http")):
        print(f"Missing video: {song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)}")
        return

    filename = link.split("/")[-1]
    filepath = os.path.join(VIDEO_PATH, filename)
    if os.path.isfile(filepath):
        return

    try:
        print(f"Downloading {filename}")
        urllib.request.urlretrieve(link, filepath)
    except Exception as e:
        print(f"Error downloading {filename}: {e}")


# --- MAIN ---
def create_song_list(data):
    """Convert JSON structure into Song objects."""
    if not data:
        print("Error: no data")
        return []

    songs = []
    if isinstance(data, dict):
        if "songs" in data:
            songs.extend(Song(x) for x in data["songs"])
        if "songHistory" in data:
            songs.extend(Song(x) for x in data["songHistory"].values())
    elif isinstance(data, list):
        songs.extend(Song(x) for x in data)

    return songs


def main():
    os.makedirs(JSON_PATH, exist_ok=True)

    json_files = [f for f in os.listdir(JSON_PATH) if f.endswith(".json")]
    if not json_files:
        print("Error: no json files found")
        return

    for file_name in json_files:
        with open(os.path.join(JSON_PATH, file_name), encoding="utf-8") as f:
            song_list = create_song_list(json.load(f))

        for song in song_list:
            if not song.has_valid_link():
                continue
            if MODE in ("audio", "both"):
                download_audio(song)
            if MODE in ("video", "both"):
                download_video(song)

    if os.path.isdir(AUDIO_PATH):
        print(f"Total songs in audio folder = {len(os.listdir(AUDIO_PATH))}")
    if os.path.isdir(VIDEO_PATH):
        print(f"Total songs in video folder = {len(os.listdir(VIDEO_PATH))}")


if __name__ == "__main__":
    main()
