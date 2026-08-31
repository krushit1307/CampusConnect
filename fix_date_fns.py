
import glob
import re

files = glob.glob("src/utils/**/*.ts", recursive=True)

for file in files:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all date-fns imports
    imports = re.findall(r"import (\w+) from [\"\']date-fns/(\w+)[\"\'];?", content)
    if imports:
        # Create named imports string
        named_imports = []
        for alias, name in imports:
            if alias == name:
                named_imports.append(name)
            else:
                named_imports.append(f"{name} as {alias}")
        
        # Replace the first import with the new combined import
        first_import = True
        new_content = []
        for line in content.split("\n"):
            match = re.match(r"import (\w+) from [\"\']date-fns/(\w+)[\"\'];?", line)
            if match:
                if first_import:
                    new_content.append("import { " + ", ".join(named_imports) + " } from \"date-fns\";")
                    first_import = False
            else:
                new_content.append(line)
        
        with open(file, "w", encoding="utf-8") as f:
            f.write("\n".join(new_content))

