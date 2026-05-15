#!/usr/bin/env node

/**
 * PayIn Address Tool - CLI Entry Point
 * HD wallet address generation and management tool
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { displaySecurityWarning, displayComingSoon } from './utils/security.js';
import { generateCommand } from './commands/generate.js';
import { verifyCommand } from './commands/verify.js';

const APP_VERSION = '1.1.0';

/**
 * Display welcome banner
 */
function displayBanner(): void {
  console.clear();
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                                    ║'));
  console.log(chalk.bold.cyan('║                  PayIn Address Tool v' + APP_VERSION + '                        ║'));
  console.log(chalk.bold.cyan('║                                                                    ║'));
  console.log(chalk.bold.cyan('║          HD Wallet Address Generation & Management                 ║'));
  console.log(chalk.bold.cyan('║                                                                    ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════════╝'));

  displaySecurityWarning();
}

/**
 * Main menu
 */
async function mainMenu(): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔑  Generate New Addresses', value: 'generate' },
        { name: '✅  Verify Address Ownership', value: 'verify' },
        { name: '📊  Balance Statistics [Coming Soon]', value: 'balance' },
        { name: '💰  Fund Collection [Coming Soon]', value: 'collect' },
        new inquirer.Separator(),
        { name: '🚪  Exit', value: 'exit' },
      ],
      pageSize: 10,
    },
  ]);

  switch (action) {
    case 'generate':
      await generateCommand();
      break;
    case 'verify':
      await verifyCommand();
      break;
    case 'balance':
      displayComingSoon('Balance Statistics');
      break;
    case 'collect':
      displayComingSoon('Fund Collection');
      break;
    case 'exit':
      console.log(chalk.green('\n👋 Thank you for using PayIn Address Tool!\n'));
      process.exit(0);
    default:
      console.log(chalk.red('\n❌ Invalid option\n'));
  }

  // Return to main menu after action completes
  const { returnToMenu } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'returnToMenu',
      message: 'Return to main menu?',
      default: true,
    },
  ]);

  if (returnToMenu) {
    console.clear();
    displayBanner();
    await mainMenu();
  } else {
    console.log(chalk.green('\n👋 Thank you for using PayIn Address Tool!\n'));
    process.exit(0);
  }
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
  try {
    displayBanner();
    await mainMenu();
  } catch (error) {
    if ((error as any).isTtyError) {
      console.error(chalk.red('\n❌ TTY Error: Prompt couldn\'t be rendered in the current environment\n'));
    } else {
      console.error(chalk.red('\n❌ Unexpected Error:'), error);
    }
    process.exit(1);
  }
}

// Run the application
main();
