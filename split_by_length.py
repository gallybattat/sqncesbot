import json
from pathlib import Path

def split_words_by_length(input_file):
    # Load words
    words = json.loads(Path(input_file).read_text())

    # Separate by length
    words_6 = [w for w in words if len(w.strip()) == 6]
    words_7 = [w for w in words if len(w.strip()) == 7]
    words_8 = [w for w in words if len(w.strip()) == 8]

    # Save each list
    Path("guesses-6.json").write_text(json.dumps(words_6, indent=2))
    Path("guesses-7.json").write_text(json.dumps(words_7, indent=2))
    Path("guesses-8.json").write_text(json.dumps(words_8, indent=2))

    print(f"✓ Saved {len(words_6)} words to guesses-6.json")
    print(f"✓ Saved {len(words_7)} words to guesses-7.json")
    print(f"✓ Saved {len(words_8)} words to guesses-8.json")

if __name__ == "__main__":
    split_words_by_length("guesses.json")
