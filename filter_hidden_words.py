import sys
import json
import spacy
from pathlib import Path

def load_words(file_path):
    with open(file_path, "r") as f:
        return json.load(f)

def save_words(words, output_path):
    with open(output_path, "w") as f:
        json.dump(words, f, indent=2)

def filter_words(wordlist, nlp):
    valid = []
    invalid = []

    for word in wordlist:
        doc = nlp(word.lower())
        token = doc[0]

        is_invalid = False

        # Rule 1: Words ending in "ing"
        if word.lower().endswith("ing"):
            is_invalid = True

        # Rule 2: Simple plural (adds 's' or 'es')
        elif token.tag_ in {"NNS", "NNPS"}:
            if token.lemma_ + "s" == token.text or token.lemma_ + "es" == token.text:
                is_invalid = True

        # Rule 3: Simple past tense (adds 'd' or 'ed')
        elif token.tag_ == "VBD":
            if token.lemma_ + "d" == token.text or token.lemma_ + "ed" == token.text:
                is_invalid = True

        (invalid if is_invalid else valid).append(word)

    return valid, invalid

def main(input_filename):
    input_path = Path(input_filename)
    wordlist = load_words(input_path)
    nlp = spacy.load("en_core_web_sm")

    valid, invalid = filter_words(wordlist, nlp)

    max_length = max(len(w) for w in wordlist)
    base_name = f"{input_path.stem.split('-')[0]}-{max_length}"

    save_words(valid, f"valid-answers-{max_length}.json")
    save_words(invalid, f"invalid-answers-{max_length}.json")

    print(f"✓ Done. {len(valid)} valid, {len(invalid)} invalid.")
    print(f"Output: valid-answers-{max_length}.json, invalid-answers-{max_length}.json")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python filter_hidden_words.py guesses-6.json")
        sys.exit(1)

    main(sys.argv[1])
