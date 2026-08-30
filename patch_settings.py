import re

with open("src/routes/settings.tsx", "r") as f:
    content = f.read()

# 1. State
state_str = """
  // --- Dietary Restrictions state ---
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [dietaryInput, setDietaryInput] = useState("");
  const dietaryInputRef = useRef<HTMLInputElement>(null);

  const handleAddDietary = () => {
    const trimmed = dietaryInput.trim();
    if (trimmed && !dietaryRestrictions.includes(trimmed)) {
      setDietaryRestrictions((prev) => [...prev, trimmed]);
    }
    setDietaryInput("");
    dietaryInputRef.current?.focus();
  };

  const handleDietaryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDietary();
    }
  };

  const handleRemoveDietary = (item: string) => {
    setDietaryRestrictions((prev) => prev.filter((d) => d !== item));
  };
"""
content = re.sub(
    r'(// --- Skills tags state ---)',
    state_str + r'\n  \1',
    content
)

# 2. Hydration
hydration_str = """
      // Hydrate dietary restrictions from profile (text[])
      if (Array.isArray(profile?.dietary_restrictions)) {
        setDietaryRestrictions(profile.dietary_restrictions as string[]);
      }
"""
content = re.sub(
    r'(// Hydrate skills from profile \(text\[\]\))',
    hydration_str + r'\n      \1',
    content
)

# 3. Payload
payload_str = """
      const dedupedDietary = [...new Set(dietaryRestrictions.map((s) => s.trim()).filter(Boolean))];
"""
content = re.sub(
    r'(const dedupedSkills = \[.*?\];)',
    r'\1\n' + payload_str,
    content
)

content = re.sub(
    r'(skills: dedupedSkills,)',
    r'\1\n        dietary_restrictions: dedupedDietary,',
    content
)

# 4. UI
ui_str = """
                {/* ── Dietary Restrictions Editor ── */}
                <div className="space-y-2 pt-2">
                  <p className="eyebrow font-bold text-black">Dietary & Accessibility Needs</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Automatically applied to all your event RSVPs. You can hide them per-event if needed.
                  </p>

                  {dietaryRestrictions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {dietaryRestrictions.map((item) => (
                        <span
                          key={item}
                          className="neu-border inline-flex items-center gap-1 bg-yellow-200 px-2.5 py-1 font-mono text-xs font-bold"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => handleRemoveDietary(item)}
                            className="ml-1 flex h-4 w-4 items-center justify-center bg-black text-white hover:bg-gray-800"
                            aria-label={`Remove ${item}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex w-full gap-2 pt-1">
                    <input
                      ref={dietaryInputRef}
                      type="text"
                      className="neu-input flex-1 font-mono text-sm"
                      placeholder="e.g. Vegan, Celiac, Peanut Allergy..."
                      value={dietaryInput}
                      onChange={(e) => setDietaryInput(e.target.value)}
                      onKeyDown={handleDietaryKeyDown}
                    />
                    <button
                      type="button"
                      onClick={handleAddDietary}
                      className="neu-border bg-black px-4 font-mono font-bold text-white hover:bg-gray-800"
                    >
                      +
                    </button>
                  </div>
                </div>
"""
content = re.sub(
    r'({\/\* ── Skills Tags Editor ── \*\/})',
    ui_str + r'\n                \1',
    content
)

with open("src/routes/settings.tsx", "w") as f:
    f.write(content)
