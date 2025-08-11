# Sqnces Analysis Tool

An interactive tool for analyzing and solving Sqnces word puzzles using information theory.

## Features

- Analyzes possible answers based on sequence constraints
- Ranks guesses by expected information gain
- Based on Grant Sanderson's (3Blue1Brown) Wordle solver algorithm
- Supports 6, 7, and 8 letter word lengths

## How to Use

1. Select the word length (6, 7, or 8 letters)
2. Enter your guesses using the on-screen keyboard or physical keyboard
3. View the ranked guesses with their expected information gain and probability
4. Use the recommendations to make optimal guesses

## Algorithm

The tool uses information theory to calculate:
- **E[Info.]**: Expected information gain from each guess
- **p(word)**: Probability of each word being the answer
- **E[Score]**: Expected number of guesses needed

Based on the excellent explanation in [3Blue1Brown's Wordle video](https://www.youtube.com/watch?v=v68zYyaEmEA).