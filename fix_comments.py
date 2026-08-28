import os, re
count = 0
for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f: content = f.read()
            new_content = re.sub(r'(?m)^(\s*)--', r'\1//', content)
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f: f.write(new_content)
                count += 1
                print(f'Fixed {path}')
print(f'Total fixed: {count}')
