"""
Download audio or video files from json files
Version 0.5

Instructions:
1. put song list jsons inside the json folder
2. run python file
3. downloaded songs will appear in "audio" and "video" folders

Supported file formats:
1. anisongdb json
2. official AMQ song history export
3. joseph song list script export
4. blissfulyoshi ranked song list
5. csl song list
"""

import os
import json
import subprocess
import urllib.request
try:
    import eyed3
except ModuleNotFoundError:
    subprocess.Popen(["python", "-m", "pip", "install", "-U", "eyed3"]).wait()
    import eyed3


mode = "both"  # audio, video, both
host = 1
host_dict = {1: "nl.catbox.video", 2: "ladist1.catbox.video", 3: "vhdist1.catbox.video"}
path = ""  # optional custom path
json_path = path + "json/"
audio_path = path + "audio/"
video_path = path + "video/"


# try a list of keys to extract data from an object
def extract_data(obj, possible_keys: list):
    for key in possible_keys:
        if "." in key:  # handle nested keys using dot notation
            keys = key.split(".")
            temp_data = obj
            for k in keys:
                if isinstance(temp_data, dict) and k in temp_data:
                    temp_data = temp_data[k]
                else:
                    break
            else:
                return temp_data
        elif key in obj:
            return obj[key]
    return None


# create song list from json data
def create_song_list(data):
    if not data or len(data) == 0:
        print("Error: no data")
        return []
    song_list = []
    if isinstance(data, dict):
        if "songs" in data:
            for x in data["songs"]:
                song_list.append(Song(x))
        if "songHistory" in data:
            for x in data["songHistory"].values():
                song_list.append(Song(x))
    elif isinstance(data, list):
        for x in data:
            song_list.append(Song(x))
    return song_list


# input json data for one song
class Song:
    def __init__(self, data):
        self.animeRomajiName = self.extract_romaji(data)
        self.animeEnglishName = self.extract_english(data)
        self.songArtist = self.extract_artist(data)
        self.songName = self.extract_song_name(data)
        self.songType = self.extract_song_type(data)  # format: Opening 1
        self.songDifficulty = self.extract_difficulty(data)
        self.animeType = self.extract_anime_type(data)
        self.animeVintage = self.extract_vintage(data)
        self.audio = self.extract_audio(data)
        self.video480 = self.extract_480(data)
        self.video720 = self.extract_720(data)

    def extract_romaji(self, data):
        return extract_data(data, ["animeRomajiName", "animeJPName", "songInfo.animeNames.romaji", "anime.romaji", "animeRomaji"])

    def extract_english(self, data):
        return  extract_data(data, ["animeEnglishName", "animeENName", "songInfo.animeNames.english", "anime.english", "animeEnglish"])

    def extract_artist(self, data):
        return extract_data(data, ["songArtist", "artist", "songInfo.artist"])

    def extract_song_name(self, data):
        return extract_data(data, ["songName", "name", "songInfo.songName"])

    def extract_song_type(self, data):
        song_type = extract_data(data, ["songType", "type", "songInfo.type"])
        if isinstance(song_type, int):
            song_type_number = extract_data(data, ["songTypeNumber", "songInfo.typeNumber"])
            type_dict = {1: "Opening", 2: "Ending", 3: "Insert Song"}
            text = type_dict[song_type]
            if song_type_number:
                text = f"{text} {song_type_number}"
            return text
        elif isinstance(song_type, str):
            return song_type
        else:
            return None

    def extract_difficulty(self, data):
        dif = extract_data(data, ["songDifficulty", "songInfo.animeDifficulty", "songInfo.songName"])
        try:
            return float(dif)
        except:
            return None

    def extract_anime_type(self, data):
        return extract_data(data, ["animeType", "songInfo.animeType"])

    def extract_vintage(self, data):
        return extract_data(data, ["animeVintage", "songInfo.vintage", "vintage"])

    def extract_audio(self, data):
        link = extract_data(data, ["audio", "videoUrl", "urls.catbox.0", "LinkMp3"])
        if isinstance(link, str) and link.endswith(".mp3"):
            return convert_url(link)
        else:
            return None

    def extract_480(self, data):
        link = extract_data(data, ["video480", "MQ", "videoUrl", "urls.catbox.480"])
        if isinstance(link, str) and link.endswith(".webm"):
            return convert_url(link)
        else:
            return None

    def extract_720(self, data):
        link = extract_data(data, ["video720", "HQ", "videoUrl", "urls.catbox.720", "LinkVideo"])
        if isinstance(link, str) and link.endswith(".webm"):
            return convert_url(link)
        else:
            return None

    # return true if there is at least 1 valid link in the song data
    def has_valid_link(self):
        for s in [self.audio, self.video480, self.video720]:
            if s is not None and s.strip() != "":
                return True
        return False

    def __str__(self):
        return f"0:{self.audio}, 480:{self.video480}, 720:{self.video720}"


# convert file name to full url
def convert_url(url):
    if not url:
        return None
    elif url.startswith("http"):
        return url
    else:
        return f"https://{host_dict[host]}/{url}"


# remove forbidden characters from file name
def sanitize_file_name(name):
    chars = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]
    for char in chars:
        name = name.replace(char, "")
    return name


# translate type id values to text
def type_text(type_id, type_number):
    if type_id == 1:
        return f"Opening {type_number}"
    if type_id == 2:
        return f"Ending {type_number}"
    if type_id == 3:
        return "Insert Song"


# shorten song type text
def shorten_type(text):
    if text[0] == "O":
        return f"OP{text.split(" ")[1]}"
    if text[0] == "E":
        return f"ED{text.split(" ")[1]}"
    if text[0] == "I":
        return "IN"


# download audio from song object
def download_audio(song):
    errors = []
    if not os.path.isdir(audio_path):
        os.mkdir(audio_path)
    if song.audio:
        new_file_name = song.audio.split("/")[-1]
        #new_file_name = sanitize_file_name(f"{song.animeEnglishName or song.animeRomajiName} - {song.songName}.mp3")
        if not os.path.isfile(audio_path + new_file_name):
            print(new_file_name)
            #print(f"{new_file_name} - {song.animeEnglishName or song.animeRomajiName or "no anime name"} - {song.songType or "no song type"}")
            try:
                urllib.request.urlretrieve(song.audio, audio_path + new_file_name)
                eyed3.log.setLevel("ERROR")
                id3 = eyed3.load(audio_path + new_file_name)
                id3.initTag()
                id3.tag.artist = song.songArtist or ""
                id3.tag.title = song.songName or ""
                id3.tag.genre = song.songType or ""
                id3.tag.album = song.animeEnglishName or song.animeRomajiName or ""
                id3.tag.save()
            except:
                errors.append(f"{song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)} {new_file_name}")

    else:
        print(f"Missing audio: {song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)}")
    if len(errors):
        print("Error downloading these files:")
        for e in errors:
            print(e)


# download video from song object
def download_video(song):
    errors = []
    if not os.path.isdir(video_path):
        os.mkdir(video_path)
    link = song.video720 or song.video480 or ""
    if link.startswith("http"):
        new_file_name = link.split("/")[-1]
        #new_file_name = sanitize_file_name(f"{song.animeEnglishName or song.animeRomajiName} {song.songName}.webm")
        if not os.path.isfile(video_path + new_file_name):
            print(new_file_name)
            #print(f"{new_file_name} - {song.animeEnglishName or song.animeRomajiName or "no anime name"} - {song.songType or "no song type"}")
            try:
                urllib.request.urlretrieve(link, video_path + new_file_name)
            except:
                errors.append(f"{song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)} {new_file_name}")
    else:
        print(f"Missing video: {song.animeEnglishName or song.animeRomajiName} {shorten_type(song.songType)}")
    if len(errors):
        print("Error downloading these files:")
        for e in errors:
            print(e)


# main function
def main():
    if not os.path.isdir(json_path):
        os.mkdir(json_path)
    for file_name in os.listdir(json_path):
        if file_name.endswith(".json"):
            with open(json_path + file_name, encoding="utf-8") as json_file:
                song_list = create_song_list(json.load(json_file))
            for song in song_list:
                if song.has_valid_link():
                    #print(song)
                    if mode == "audio" or mode == "both":
                        download_audio(song)
                    if mode == "video" or mode == "both":
                        download_video(song)


    if len(os.listdir(json_path)) == 0:
        print("Error: no json files found")
    if os.path.isdir(audio_path):
        print(f"total songs in audio folder = {len(os.listdir(audio_path))}")
    if os.path.isdir(video_path):
        print(f"total songs in video folder = {len(os.listdir(video_path))}")


main()
