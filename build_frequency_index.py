#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

import spacy


def load_frequency_map(freq_path: Path) -> Dict[str, int]:
    """
    Parse frequency-alpha-alldicts.txt into a rank map: word -> 1-based rank.
    """
    rank_map: Dict[str, int] = {}
    rank_re = re.compile(
        r"^\s*(\d+)\s+([A-Za-z']+)\s+([\d,]+)\s+(\d+\.\d+%)\s+(\d+\.\d+%)"
    )

    with freq_path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if not line or line.startswith("#"):
                continue
            m = rank_re.match(line)
            if not m:
                continue
            rank = int(m.group(1))
            word = m.group(2).lower()
            if word not in rank_map:
                rank_map[word] = rank
    return rank_map


def is_simple_plural(word: str, lemma: str, pos: str) -> bool:
    return pos == "NOUN" and (word == lemma + "s" or word == lemma + "es")


def is_simple_past(word: str, lemma: str, pos: str) -> bool:
    return pos == "VERB" and (word == lemma + "ed" or word == lemma + "d")


def is_ing_end(word: str) -> bool:
    return word.endswith("ing")


def classify_and_sort(words: List[str], rank_map: Dict[str, int], nlp) -> Dict[str, int]:
    BIG = 10**12  # large rank for unknown words

    # Classify words as invalid or valid
    word_flags = []
    for w in words:
        wl = w.lower()
        if is_ing_end(wl):
            invalid = True
        else:
            doc = nlp(wl)
            token = doc[0] if doc else None
            if token:
                lemma = token.lemma_.lower()
                pos = token.pos_
                invalid = is_simple_plural(wl, lemma, pos) or is_simple_past(wl, lemma, pos)
            else:
                invalid = False
        word_flags.append((wl, invalid))

    # Sort: valid first by rank, then invalid by rank
    def sort_key(item):
        word, invalid = item
        rank = rank_map.get(word, BIG)
        return (1 if invalid else 0, rank, word)

    sorted_words = [w for w, _ in sorted(word_flags, key=sort_key)]

    # Build index: word -> position
    return {w: i for i, w in enumerate(sorted_words)}


def infer_maxlen_from_filename(p: Path) -> int:
    m = re.search(r"(\d+)", p.stem)
    return int(m.group(1)) if m else -1


def main():
    ap = argparse.ArgumentParser(
        description="Build a frequency-sorted index {word: position}, "
                    "placing invalid forms (S/ES plurals, D/ED past tense, ING words) at the bottom."
    )
    ap.add_argument("wordlist_json", help="Path to guesses-<N>.json")
    ap.add_argument("--frequency-file", default="frequency-alpha-alldicts.txt")
    ap.add_argument("--spacy-model", default="en_core_web_sm")
    ap.add_argument("--output", default=None)
    args = ap.parse_args()

    wordlist_path = Path(args.wordlist_json)
    freq_path = Path(args.frequency_file)

    words_raw = json.loads(wordlist_path.read_text(encoding="utf-8"))
    words = [w.strip() for w in words_raw if w and isinstance(w, str)]

    rank_map = load_frequency_map(freq_path)

    try:
        nlp = spacy.load(args.spacy_model, disable=["ner", "parser", "textcat"])
    except OSError:
        raise SystemExit(
            f"spaCy model '{args.spacy_model}' not found.\n"
            f"Install it with:\n  python -m spacy download {args.spacy_model}"
        )

    index = classify_and_sort(words, rank_map, nlp)

    inferred_len = infer_maxlen_from_filename(wordlist_path)
    if inferred_len == -1:
        inferred_len = max((len(w) for w in words), default=0)

    out_path = Path(args.output) if args.output else wordlist_path.parent / f"answers-{inferred_len}-index.json"
    out_path.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote {out_path} with {len(index)} entries.")


if __name__ == "__main__":
    main()
