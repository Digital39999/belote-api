# Belote API

A TypeScript library for playing Belote card game with bot support. Works in Node.js and browsers.

## Installation

```bash
# Using pnpm
pnpm add belote

# Using npm
npm install belote

# Using yarn
yarn add belote
```

## Usage

### Node.js (CommonJS)
```javascript
const { Belote, GamePhase } = require('belote');

const game = new Belote({
    endValue: 501,
    moveTime: 30,
    botDelayMs: 1000
});

// Add players
game.addBot('Bot 1', 1);
game.addBot('Bot 2', 2);
game.addBot('Bot 3', 1);
game.addBot('Bot 4', 2);

// Start game
game.startGame();
```

### Node.js (ES Modules)
```javascript
import { Belote, GamePhase } from 'belote';

const game = new Belote({
    endValue: 501,
    moveTime: 30,
    botDelayMs: 1000
});

// Add players
game.addBot('Bot 1', 1);
game.addBot('Bot 2', 2);
game.addBot('Bot 3', 1);
game.addBot('Bot 4', 2);

// Start game
game.startGame();
```

### Browser (via CDN)
```html
<!DOCTYPE html>
<html>
<head>
    <title>Belote Game</title>
</head>
<body>
    <!-- Load from unpkg -->
    <script src="https://unpkg.com/belote@latest/dist/browser/belote-api.min.js"></script>
    
    <script>
        // Available as global BeloteAPI
        const { Belote, GamePhase } = BeloteAPI;
        
        const game = new Belote({
            endValue: 501,
            moveTime: 30,
            botDelayMs: 1000
        });

        // ...
    </script>
</body>
</html>
```

### Browser (ES Modules)
```html
<!DOCTYPE html>
<html>
<head>
    <title>Belote Game</title>
</head>
<body>
    <script type="module">
        import { Belote, GamePhase } from 'https://unpkg.com/belote@latest/dist/esm/index.js';
        
        const game = new Belote({
            endValue: 501,
            moveTime: 30,
            botDelayMs: 1000
        });

		// ...
    </script>
</body>
</html>
```

## API

### Belote Class

#### Constructor
```typescript
new Belote(options?: Partial<GameOptions>)
```

#### Methods
- `playerJoin(playerName?: string, teamId?: number, playerId?: string): Player`
- `addBot(botName?: string, teamId?: number): Player`
- `startGame(): void`
- `bid(playerId: string, call: CardColor | 'pass'): void`
- `makeCall(playerId: string, cards: Card[]): void`
- `playCard(playerId: string, card: Card): void`

#### Events
- `gameStarted`
- `playerJoined`
- `roundStarted`
- `biddingStarted`
- `adutChosen`
- `gameEnded`
- And many more...

## Development

```bash
# Install dependencies
pnpm install

# Build all formats
pnpm run build

# Watch for changes
pnpm run watch

# Lint code
pnpm run lint
```

## Build Outputs

- `dist/cjs/` - CommonJS build for Node.js
- `dist/esm/` - ES Modules build for modern environments
- `dist/browser/` - UMD build for browsers
- `dist/types/` - TypeScript type definitions

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.