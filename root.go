/*
Copyright © 2025 Gally Battat <dev@batt.at>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

type tileType int64

const (
	Undefined tileType = iota
	Sequence
	Correct
	Misplaced
	Incorrect
	Empty
)

type tile struct {
	letter   rune
	tileType tileType
}

type guessResult struct {
	tiles      []tile
	gameLength int
	tilesHash  string
}

func (r *guessResult) AddTile(t tile) {
	r.tiles = append(r.tiles, t)
}

func (r *guessResult) sqnce() string {
	var sqnce strings.Builder
	for _, t := range r.tiles {
		if t.tileType == Sequence {
			sqnce.WriteRune(t.letter)
		}
	}
	return sqnce.String()
}

func (r *guessResult) guessSqnceIndex() int {
	for i, t := range r.tiles {
		if t.tileType == Sequence {
			return i
		}
	}
	return -1
}

func (r *guessResult) answerSqnceIndex() int {
	offset := 0
	noEmpty := true
	var sqnceEnd int
	for i, t := range r.tiles {
		if t.tileType == Empty {
			noEmpty = false
			offset++
		}
		if t.tileType == Sequence {
			if offset != 0 {
				return i - offset
			}
			sqnceEnd = i
		}
	}
	if len(r.tiles) < r.gameLength && noEmpty {
		return -1
	} else {
		return sqnceEnd - 2 + offset
	}
}

func (r *guessResult) minLettersBeforeSqnce() int {
	return r.guessSqnceIndex()
}

func (r *guessResult) minLettersAfterSqnce() int {
	return len(r.tiles) - r.guessSqnceIndex() - 3
}

func (r *guessResult) sqnceOffset(answer string) int {
	return r.guessSqnceIndex() - strings.Index(answer, r.sqnce())
}

func getGuessResult(sqnce string, guess string, answer string) guessResult {
	result := guessResult{}
	result.gameLength = len(answer)
	for _, c := range guess {
		result.AddTile(tile{letter: c, tileType: Undefined})
	}

	guessSqnceIndex := strings.Index(guess, sqnce)
	answerSqnceIndex := strings.Index(answer, sqnce)
	sqnceOffset := guessSqnceIndex - answerSqnceIndex
	lenOffset := len(answer) - len(guess)

	answerData := []rune(answer)

	// Function to determine if we should continue processing the current tile
	shouldBreak := func(i int) bool {
		if sqnceOffset > 0 {
			return i > len(result.tiles)+1-sqnceOffset
		}
		return len(answer) < i+1-sqnceOffset
	}

	// First pass: Set sqnce tiles
	for i := range 3 {
		result.tiles[guessSqnceIndex+i].tileType = Sequence
		answerData[answerSqnceIndex+i] = ' '
	}

	// Second pass: Set empty tiles
	if sqnceOffset > 0 {
		for i := range sqnceOffset {
			result.tiles[i].tileType = Empty
		}
	} else if sqnceOffset+lenOffset < 0 {
		for i := range -sqnceOffset {
			result.tiles[len(result.tiles)+sqnceOffset+i].tileType = Empty
		}
	}

	// Third pass: Set correct tiles
	for i, tile := range result.tiles {
		if shouldBreak(i) {
			break
		}
		if i-sqnceOffset >= 0 {
			if tile.tileType == Undefined && tile.letter == answerData[i-sqnceOffset] {
				result.tiles[i].tileType = Correct
				answerData[i-sqnceOffset] = ' '
			}
		}
	}

	// Fourth pass: Set misplaced tiles
	for i, tile := range result.tiles {
		if shouldBreak(i) {
			break
		}
		if tile.tileType == Undefined {
			for j, r := range answerData {
				if tile.letter == r {
					result.tiles[i].tileType = Misplaced
					answerData[j] = ' '
					break
				}
			}
		}
	}

	// Fifth pass: Mark remaining undefined tiles as incorrect
	for i, tile := range result.tiles {
		if shouldBreak(i) {
			break
		}
		if tile.tileType == Undefined {
			result.tiles[i].tileType = Incorrect
		}
	}

	return result
}

func getGuessResults(sqnce string, guesses []string, answer string) []guessResult {
	var results []guessResult
	for _, guess := range guesses {
		results = append(results, getGuessResult(sqnce, guess, answer))
	}
	return results
}

func validatePossibleAnswer(possibleAnswer string, result guessResult, guessNumber int) bool {
	if guessNumber == 0 {
		// Check if length is correct
		if len(possibleAnswer) != result.gameLength {
			return false
		}
	}
	checks := []func(string, guessResult) bool{
		// Check if sqnce is in the possible answer
		func(possibleAnswer string, result guessResult) bool {
			return strings.Contains(possibleAnswer, result.sqnce())
		},
		// Check if the sqnce is in the correct position
		func(possibleAnswer string, result guessResult) bool {
			return result.answerSqnceIndex() == -1 || possibleAnswer[result.answerSqnceIndex():result.answerSqnceIndex()+3] == result.sqnce()[0:3]
		},
		// Check if correct number of letters before the sqnce
		func(possibleAnswer string, result guessResult) bool {
			if result.answerSqnceIndex() != -1 {
				return true
			}
			if result.minLettersBeforeSqnce() > strings.Index(possibleAnswer, result.sqnce()) {
				return false
			}
			if result.minLettersAfterSqnce() > len(possibleAnswer)-strings.Index(possibleAnswer, result.sqnce())-3 {
				return false
			}
			return true
		},
		// Check if Correct tiles match
		func(possibleAnswer string, result guessResult) bool {
			for i, tile := range result.tiles {
				if tile.tileType == Correct {
					if i-result.sqnceOffset(possibleAnswer) < 0 {
						return false
					} else if tile.letter != []rune(possibleAnswer)[i-result.sqnceOffset(possibleAnswer)] {
						return false
					}
				}
			}
			return true
		},
		// Check if Incorrect tiles are not in the possible answer
		func(possibleAnswer string, result guessResult) bool {
			modifiedAnswer := strings.Replace(possibleAnswer, result.sqnce(), strings.Repeat(" ", 3), 1)
			for _, tile := range result.tiles {
				if tile.tileType == Incorrect {
					if strings.ContainsRune(modifiedAnswer, tile.letter) {
						return false
					}
				}
			}
			return true
		},
		// check if Misplaced tiles are in the possible answer in the same position
		func(possibleAnswer string, result guessResult) bool {
			for i, tile := range result.tiles {
				if tile.tileType == Misplaced {
					if i-result.sqnceOffset(possibleAnswer) < 0 || i-result.sqnceOffset(possibleAnswer) >= len(possibleAnswer) {
						return true
					} else if tile.letter == []rune(possibleAnswer)[i-result.sqnceOffset(possibleAnswer)] {
						return false
					}
				}
			}
			return true
		},
		// Check if Misplaced tiles are in the possible answer in a different position
		func(possibleAnswer string, result guessResult) bool {
			modifiedAnswer := strings.Replace(possibleAnswer, result.sqnce(), strings.Repeat(" ", 3), 1)
			for _, tile := range result.tiles {
				if tile.tileType == Correct {
					modifiedAnswer = strings.Replace(modifiedAnswer, string(tile.letter), " ", -1)
				}
			}
			for _, tile := range result.tiles {
				if tile.tileType == Misplaced {
					if !strings.ContainsRune(modifiedAnswer, tile.letter) {
						return false
					}
				}
			}
			return true
		},
	}
	for _, check := range checks {
		if !check(possibleAnswer, result) {
			return false
		}
		// fmt.Println(possibleAnswer)
	}
	return true
}

func filterPossibleAnswers(possibleAnswers *[]string, guessResults []guessResult) []string {
	filteredPossibleAnswers := (*possibleAnswers)
	for guessNumber, guessResult := range guessResults {
		n := 0
		for _, possibleAnswer := range filteredPossibleAnswers {
			if validatePossibleAnswer(possibleAnswer, guessResult, guessNumber) {

				filteredPossibleAnswers[n] = possibleAnswer
				n++
			}
		}
		filteredPossibleAnswers = filteredPossibleAnswers[:n]
	}
	*possibleAnswers = filteredPossibleAnswers
	return filteredPossibleAnswers
}

func calculateEntropy(probabilities map[string]float64) float64 {
	entropy := 0.0
	for _, p := range probabilities {
		if p > 0 {
			entropy += -p * math.Log2(p)
		}
	}
	return entropy
}

func hashTiles(tiles []tile) string {
	var result string
	for _, t := range tiles {
		result += fmt.Sprintf("%v", t) // Convert each tile to a string
	}
	return result
}

func calculateGuessEntropy(sqnce string, guess string, possibleAnswers []string) float64 {
	guessDistribution := make(map[string][]string)
	guessDistributionProbabilities := make(map[string]float64)
	for _, possibleAnswer := range possibleAnswers {
		guessResult := getGuessResult(sqnce, guess, possibleAnswer)
		guessResult.tilesHash = hashTiles(guessResult.tiles)
		guessDistribution[guessResult.tilesHash] = append(guessDistribution[guessResult.tilesHash], possibleAnswer)
		for k, v := range guessDistribution {
			guessDistributionProbabilities[k] = float64(len(v)) / float64(len(possibleAnswers))
		}
	}
	return calculateEntropy(guessDistributionProbabilities)

}

func equalProbabilityEntropy(x int) float64 {
	if x <= 0 {
		return 0
	}
	return math.Log2(float64(x))
}

func getValidGuessList(filename string, words *[]string) error {
	// Open the JSON file
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("error opening file: %w", err)
	}
	defer file.Close()

	// Read file contents
	byteValue, err := io.ReadAll(file)
	if err != nil {
		return fmt.Errorf("error reading file: %w", err)
	}

	// Unmarshal JSON into the provided slice
	err = json.Unmarshal(byteValue, words)
	if err != nil {
		return fmt.Errorf("error unmarshaling JSON: %w", err)
	}

	return nil
}

func (r *guessResult) PrettyPrint() {
	sqnceStyle := color.New(color.BgWhite)
	correctStyle := color.New(color.BgGreen)
	misplacedStyle := color.New(color.BgYellow)
	incorrectStyle := color.New(color.BgRed)
	emptyStyle := color.New(color.BgBlack)
	for _, tile := range r.tiles {
		switch tile.tileType {
		case Sequence:
			sqnceStyle.Print(string(tile.letter))
		case Correct:
			correctStyle.Print(string(tile.letter))
		case Misplaced:
			misplacedStyle.Print(string(tile.letter))
		case Incorrect:
			incorrectStyle.Print(string(tile.letter))
		case Empty:
			emptyStyle.Print(string(tile.letter))
		default:
			fmt.Print(string(tile.letter))
		}
	}
	fmt.Println()
}

func printMapDescending(m map[string]float64) {
	type kv struct {
		Key   string
		Value float64
	}

	var sorted []kv
	for k, v := range m {
		sorted = append(sorted, kv{k, v})
	}

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	for _, entry := range sorted {
		fmt.Printf("%s: %.2f\n", entry.Key, entry.Value)
	}
}

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "sqncesbot",
	Short: "A tool that analyses sqnces.com puzzles",
	Long:  `A tool that analyzes sqnces.com puzzles. It provides optimal guesses at each stage of solving, along with relevent data.`,
	Run: func(cmd *cobra.Command, args []string) {
		sqnce := strings.ToUpper(args[1])
		if utf8.RuneCountInString(sqnce) != 3 {
			fmt.Println("Invalid sqnce")
			return
		}

		guesses := args[1 : len(args)-1]
		answer := args[len(args)-1]
		results := getGuessResults(sqnce, guesses, answer)

		var validGuessList6 []string
		err := getValidGuessList("guesses-6.json", &validGuessList6)
		if err != nil {
			fmt.Println("Error:", err)
			return
		}

		var validGuessList7 []string
		err = getValidGuessList("guesses-7.json", &validGuessList7)
		if err != nil {
			fmt.Println("Error:", err)
			return
		}

		var validGuessList8 []string
		err = getValidGuessList("guesses-8.json", &validGuessList8)
		if err != nil {
			fmt.Println("Error:", err)
			return
		}

		validGuessLists := make(map[int][]string)
		validGuessLists[6] = validGuessList6
		validGuessLists[7] = validGuessList7
		validGuessLists[8] = validGuessList8

		gameLength, err := strconv.Atoi(args[0])
		if err != nil {
			fmt.Println("Error:", err)
			return
		}
		possibleAnswers := validGuessLists[gameLength]

		// Filter out possible answers that do not contain the sqnce
		sqnceResult := getGuessResult(sqnce, sqnce, answer)
		possibleAnswers = filterPossibleAnswers(&possibleAnswers, []guessResult{sqnceResult})

		baseEntropy := equalProbabilityEntropy(len(possibleAnswers))

		var observedResults []guessResult
		for _, r := range results {
			observedResults = append(observedResults, r)
			r.PrettyPrint()
			possibleAnswers = filterPossibleAnswers(&possibleAnswers, observedResults)
			fmt.Println("Possible answers: ", len(possibleAnswers))
			fmt.Printf("Entropy: %.2f\n", equalProbabilityEntropy(len(possibleAnswers)))
			if baseEntropy-equalProbabilityEntropy(len(possibleAnswers)) != 0 {
				fmt.Printf("Actual reduction in entropy: %.2f\n", baseEntropy-equalProbabilityEntropy(len(possibleAnswers)))
			}
			baseEntropy = equalProbabilityEntropy(len(possibleAnswers))
			fmt.Println()
			entropyOfAllPossibleAnswers := map[string]float64{}
			for _, possibleAnswer := range possibleAnswers {
				entropy := calculateGuessEntropy(sqnce, possibleAnswer, possibleAnswers)
				entropyOfAllPossibleAnswers[possibleAnswer] = entropy
				// fmt.Println("Entropy of", possibleAnswer, ":", entropy)
			}
			printMapDescending(entropyOfAllPossibleAnswers)
			fmt.Println()
		}

		/* 		// Calculate the entropy of all possible first guesses
		   		for _, possibleAnswer := range possibleAnswers {
		   			entropy := calculateGuessEntropy(sqnce, possibleAnswer, possibleAnswers)
		   			fmt.Println("Entropy of", possibleAnswer, ":", entropy)
		   		}

		   		possibleAnswers = filterPossibleAnswers(&possibleAnswers, results)

		   		fmt.Println("Possible answers: ", len(possibleAnswers))


		   		// Calculate the entropy of all possible guesses after guess results
		   		for _, possibleAnswer := range possibleAnswers {
		   			entropy := calculateGuessEntropy(sqnce, possibleAnswer, possibleAnswers)
		   			entropyOfAllPossibleAnswers[possibleAnswer] = entropy
		   		} */

		/* 		fmt.Println()
		   		fmt.Println("Possible answers: ", len(possibleAnswers))
		   		fmt.Println(possibleAnswers) */
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	// rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.sqncesbot.yaml)")

	// Cobra also supports local flags, which will only run
	// when this action is called directly.
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
