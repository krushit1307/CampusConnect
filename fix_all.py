
import glob
import re
import os

# 1. Fix database.types.ts duplicate dietary_restrictions
db_path = "src/types/database.types.ts"
if os.path.exists(db_path):
    with open(db_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"(dietary_restrictions\?: string\[\] \| null;\n)\s*dietary_restrictions: string\[\] \| null;", r"\1", content)
    with open(db_path, "w", encoding="utf-8") as f:
        f.write(content)

# 2. Fix supabase imports in src/services
services_files = glob.glob("src/services/**/*.ts", recursive=True)
for file in services_files:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()
    
    new_content = content.replace("from \"../lib/supabase\"", "from \"../lib/supabase/client\"")
    new_content = new_content.replace("from \"@/lib/supabase\"", "from \"@/lib/supabase/client\"")
    new_content = new_content.replace("from '../lib/supabase'", "from '../lib/supabase/client'")
    new_content = new_content.replace("from '@/lib/supabase'", "from '@/lib/supabase/client'")
    
    if new_content != content:
        with open(file, "w", encoding="utf-8") as f:
            f.write(new_content)

# 3. Add msw to store tests
store_tests = glob.glob("src/store/**/*.test.ts", recursive=True)
for file in store_tests:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content.replace("from \"msw\"", "from \"vitest\"")
    new_content = new_content.replace("from 'msw'", "from 'vitest'")
    if new_content != content:
        with open(file, "w", encoding="utf-8") as f:
            f.write(new_content)

