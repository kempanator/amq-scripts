"""
Combine multiple json files into one
Version 0.2

Instructions:
1. open json folder
2. create new folder with the new list name you want
3. add json files to that folder
4. run python file
5. combined json file gets created in json folder
"""

import os
import json

path = ""  # optional custom path
json_path = path + "json/"


# look for folders within json folder, look for json files and combine their contents into a new json file
def combine():
    if not os.path.isdir(json_path):
        os.mkdir(json_path)
    for folder_name in os.listdir(json_path):
        if os.path.isdir(json_path + folder_name):
            combined_data = []
            for file_name in os.listdir(json_path + folder_name):
                with open(os.path.join(json_path, folder_name, file_name), "r", encoding="utf-8") as file:
                    data = json.load(file)
                if isinstance(data, dict):  # official amq json
                    if "songs" in data:
                        for item in data["songs"]:
                            combined_data.append(item)
                elif isinstance(data, list):  # anisongdb or joseph json
                    for item in data:
                        combined_data.append(item)
            print(folder_name + ".json")
            new_json = json_path + folder_name + ".json"
            if not os.path.isfile(new_json):
                with open(new_json, "w", encoding="utf-8") as file:
                    json.dump(combined_data, file, indent=None, separators=(",", ":"))


combine()
