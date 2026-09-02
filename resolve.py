import re

def resolve_conflicts(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace everything from <<<<<<< HEAD to ======= with nothing
    # and from ======= to >>>>>>> origin/main we keep, but we must remove the garbage lines like " feature/vendor-contract-nudges" and " main"
    
    def replacer(match):
        head_content = match.group(1)
        origin_content = match.group(2)
        
        # Clean up origin_content
        lines = origin_content.split('\n')
        cleaned_lines = []
        for line in lines:
            if line.strip() == "feature/vendor-contract-nudges":
                continue
            if line.strip() == "main":
                continue
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines).strip('\n')

    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main', re.DOTALL)
    
    new_content = pattern.sub(replacer, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

resolve_conflicts('src/routes/events.$eventId.tsx')
resolve_conflicts('supabase/functions/toggle-rsvp/index.ts')
