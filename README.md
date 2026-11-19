# pddms

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

The application keeps all of its data in **one SQLite database file**, `./pddms.db` by default
(installed builds keep it in the app's user-data folder). Copy `.env.example` to `.env` only to use
a different file. Database files are ignored by Git. See [docs/database.md](docs/database.md) for
the tables, identifier formats and medicine categories.

Initialize or update the local database manually with:

```bash
$ npm run setup:dev
```

### Development

```bash
$ npm run dev
```

`npm run dev` runs migrations before Electron starts. On an empty database, the application opens
the first-launch flow and requires creation of the master account. No default credentials or
development account are created.

For demonstrations, `npm run demo:dev` starts the app on a demo copy of the same database
(`pddms-demo.db`, same tables) with sample accounts and records, used instead of `pddms.db`, never
alongside it. See [docs/demo-setup.md](docs/demo-setup.md).

Authentication sessions are held by the Electron main process. Renderer refreshes retain the
current session, while fully quitting and restarting the application requires signing in again.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
