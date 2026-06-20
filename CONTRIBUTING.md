# Contributing to Veritas

First off, thank you for considering contributing to Veritas! It's people like you that make Web3 an amazing community.

## 🛠️ How to Contribute

### 1. Reporting Bugs
- Check if the bug has already been reported in the Issues tab.
- If not, open a new issue with a clear title and description.
- Include steps to reproduce the bug, expected behavior, and actual behavior.
- Mention your environment (OS, Node version, Browser).

### 2. Suggesting Enhancements
- Open a new issue and label it as an `enhancement`.
- Describe the feature you want to add and why it would be beneficial.
- If you have an idea of how to implement it, please include that!

### 3. Pull Requests
1. Fork the repo and create your branch from `main` or `develop`.
2. Install dependencies by running `npm install` at the root.
3. Make your changes in the appropriate workspace (`frontend`, `contracts`, or `packages/*`).
4. If you've added code that should be tested, add tests.
5. Ensure the test suite passes (`forge test` for contracts, `npm run typecheck` / `npm run lint` for frontend).
6. Commit your changes using conventional commits (e.g., `feat: added new UI component`, `fix: corrected hash anchoring bug`).
7. Push to your fork and submit a Pull Request.

## 🏗️ Development Workflow

- **Monorepo Setup**: We use npm workspaces. Make sure you run installations from the root directory.
- **Smart Contracts**: We use Foundry. Ensure you test your changes thoroughly before submitting.
- **Frontend**: We use Next.js 15, Tailwind, and Wagmi. Ensure your code is responsive and handles wallet connection edge cases gracefully.

## 📝 Code Style

- **Frontend**: We use ESLint and Prettier. Please run `npm run lint` before committing.
- **Contracts**: We use the standard Foundry formatter. Run `forge fmt` before committing any Solidity code.

## 🤝 Code of Conduct
Please be respectful and considerate to others. We value collaboration and constructive feedback.
