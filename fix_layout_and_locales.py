import json
import re

# 1. Update Locales
def update_locale(file_path, new_keys):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for k, v in new_keys.items():
        data[k] = v
        
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

update_locale('src/locales/en.json', {
    "clockMode": "Clock Mode"
})

update_locale('src/locales/ja.json', {
    "clockMode": "時間入力モード"
})

print("Updated locale files")

# 2. Fix Mobile Layout in App.jsx
file_path = 'src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add flex-wrap to header
header_old = '<div className="max-w-5xl mx-auto flex justify-between items-center">'
header_new = '<div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-2">'
content = content.replace(header_old, header_new)

# Adjust title size on mobile
title_old = '<h1 className="text-lg font-bold">{t(\'appTitle\')}</h1>'
title_new = '<h1 className="text-base sm:text-lg font-bold">{t(\'appTitle\')}</h1>'
content = content.replace(title_old, title_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.jsx layout")
