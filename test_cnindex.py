import requests
import re

headers = {'User-Agent': 'Mozilla/5.0'}
res = requests.get('http://www.cnindex.com.cn/js/app/index-detail.js', headers=headers)
print("Finding URLs in JS:")
for m in re.finditer(r'(?:url|api)\s*:\s*[\'"]([^\'\"]+)[\'"]', res.text):
    print(m.group(1))

# Also find any string containing "index" or "pe"
for m in re.finditer(r'[\'"]([^\'\"]*(?:index|pe|PE)[^\'\"]*)[\'"]', res.text):
    if len(m.group(1)) > 5 and len(m.group(1)) < 50:
        print("str:", m.group(1))
