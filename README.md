# Nonopixler

[Nonogram](https://en.wikipedia.org/wiki/Nonogram) game written in plain vanilla JS. You can play [here](nuggets.egimoto.com).

## 🕹️ How to play
The game is played on a field made up from many square tiles similar to sudoku. But instead of filling each tile with a digit you have to figure out whether each tile needs to be colored in or remain blank. Next to the rows and columns are numbers that serve as hints how many tiles need to be colored in succession to form a block. Rows and columns are interpreted separately, and two blocks may not touch directly.

Below is a simple example: `🟦` marks a colored tile, and `⚪` a blank one.

### Empty game field:

||||||||
|---	|---	|---	|---	|---	|---	|---	|
|   	|   	| 1 	| 1 	|   	|   	|   	|
|   	|   	| 1 	| 1 	| 3 	| 1 	| 3 	|
|   	| 1 	| `⚪` | `⚪` | `⚪` | `⚪` | `⚪` |
|   	| 5 	| `⚪` | `⚪` | `⚪` | `⚪` | `⚪` |
| 1 	| 1 	| `⚪` | `⚪` | `⚪` | `⚪` | `⚪` |
| 2 	| 1 	| `⚪` | `⚪` | `⚪` | `⚪`	| `⚪` |


### Solved game field:

||||||||
|---	|---	|---	|---	|---	|---	|---	|
|   	|   	| 1 	| 1 	|   	|   	|   	|
|   	|   	| 1 	| 1 	| 3 	| 1 	| 3 	|
|   	| 1 	| `⚪` | `⚪` | `🟦` | `⚪` | `⚪` |
|   	| 5 	| `🟦` | `🟦` | `🟦` | `🟦` | `🟦` |
| 1 	| 1 	| `⚪` | `⚪` | `🟦` | `⚪` | `🟦` |
| 2 	| 1 	| `🟦` | `🟦` | `⚪` | `⚪`	| `🟦` |

## 🌍 How to host
This is a purely statically hosted web app. The server does not have to do anything except providing the files in the `src` directory.

## 📃 License
This project is created by [PreyMa](www.github.com/PreyMa) and licensed under the MIT license.
