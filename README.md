# Exc-Make-Fune

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/scoobydoxyz/Exc-Make-Fune/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/scoobydoxyz/Exc-Make-Fune/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a frozen DefiLlama snapshot of 758 protocols, ranks every rankable pre-token protocol by an implied value derived from the snapshot's own TVL, 7-day growth, age, chain count and category weight, and gives each one a concrete 7-step farm plan with costs and times. A separate Live view shows the top 24 protocols whose tokens already trade, at market value.

## Model (radar-2)

`implied = TVL × 0.25 × growth × maturity × chain × category`, where growth clamps the 7-day TVL change to −60…120%, maturity rises with the protocol's age (unknown age = 365 days), chain adds 3% per extra chain (max 4), and category scales 0.95–1.05 by the category's share of rankable pre-token TVL in the snapshot itself. No protocol name is special-cased. The board ranks all 198 rankable pre-token protocols, including 40 watchlist rows and 138 early rows below the $50M floor.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=m2nynwfm&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
