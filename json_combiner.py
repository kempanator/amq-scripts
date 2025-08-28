"""
Combine multiple JSON files into one per subfolder.
Version 0.3

Instructions:
1. Place a `json` folder in the working directory (or set a custom path below).
2. Inside `json`, create subfolders named after your desired output file.
3. Add JSON files into those subfolders.
4. Run this script.
5. Each subfolder will produce a combined JSON file in the `json` folder.
"""

import os
import json

# Optional custom path (absolute or relative)
BASE_PATH = ""
JSON_PATH = os.path.join(BASE_PATH, "json")


def load_json(file_path: str):
    """Safely load a JSON file."""
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def combine_folder(folder_path: str) -> list:
    """Combine JSON data from all files in a folder into one list."""
    combined_data = []
    for file_name in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file_name)
        if not os.path.isfile(file_path) or not file_name.endswith(".json"):
            continue  # skip non-files and non-json

        data = load_json(file_path)

        if isinstance(data, dict) and "songs" in data:  # AMQ JSON format
            combined_data.extend(data["songs"])
        elif isinstance(data, list):  # AnisongDB/Joseph format
            combined_data.extend(data)
        else:
            print(f"⚠️ Skipped unrecognized format: {file_name}")

    return combined_data


def combine_all():
    """Look for subfolders inside JSON_PATH and combine their contents."""
    os.makedirs(JSON_PATH, exist_ok=True)

    for folder_name in os.listdir(JSON_PATH):
        folder_path = os.path.join(JSON_PATH, folder_name)
        if not os.path.isdir(folder_path):
            continue

        combined_data = combine_folder(folder_path)
        if not combined_data:
            print(f"⚠️ No valid data found in {folder_name}, skipping.")
            continue

        output_file = os.path.join(JSON_PATH, f"{folder_name}.json")
        with open(output_file, "w", encoding="utf-8") as out_file:
            json.dump(combined_data, out_file, ensure_ascii=False, separators=(",", ":"))

        print(f"✅ Created {output_file}")


if __name__ == "__main__":
    combine_all()
