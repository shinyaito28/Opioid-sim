import json

def update_locale(file_path, new_keys):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for k, v in new_keys.items():
        data[k] = v
        
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

update_locale('src/locales/en.json', {
    "now": "Now"
})

update_locale('src/locales/ja.json', {
    "now": "現在"
})

print("Updated locale files for Real-time Indicator")
