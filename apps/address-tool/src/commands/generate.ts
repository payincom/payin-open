/**
 * Generate addresses command
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Protocol, AddressData } from '../types.js';
import {
  createOrImportMnemonic,
  generateAddresses,
  createWalletInfo,
} from '../utils/wallet.js';
import { exportToCSV, generateFilename } from '../utils/csv.js';
import {
  displayMnemonic,
  displayMasterPublicKey,
  displayGenerationSummary,
  displayFileSaved,
} from '../utils/security.js';

export async function generateCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n🔑 Generate HD Wallet Addresses\n'));

  // Step 1: Select protocol
  const { protocol } = await inquirer.prompt<{ protocol: Protocol }>([
    {
      type: 'list',
      name: 'protocol',
      message: 'Select protocol:',
      choices: [
        { name: 'EVM (Ethereum, Polygon, etc.)', value: 'evm' },
        { name: 'Tron', value: 'tron' },
      ],
    },
  ]);

  // Step 2: Mnemonic source
  const { mnemonicSource } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mnemonicSource',
      message: 'Mnemonic phrase:',
      choices: [
        { name: 'Generate new mnemonic (recommended for new wallet)', value: 'generate' },
        { name: 'Import existing mnemonic', value: 'import' },
      ],
    },
  ]);

  let mnemonicPhrase: string | undefined;
  if (mnemonicSource === 'import') {
    const { inputMnemonic } = await inquirer.prompt([
      {
        type: 'password',
        name: 'inputMnemonic',
        message: 'Enter your mnemonic phrase (12 or 24 words):',
        mask: '*',
        validate: (input: string) => {
          const words = input.trim().split(/\s+/);
          if (words.length === 12 || words.length === 24) {
            return true;
          }
          return 'Please enter a valid 12 or 24 word mnemonic phrase';
        },
      },
    ]);
    mnemonicPhrase = inputMnemonic;
  }

  // Create or import mnemonic
  const mnemonic = createOrImportMnemonic(mnemonicPhrase);

  // Display mnemonic
  displayMnemonic(mnemonic.phrase, mnemonicSource === 'generate');

  // Get wallet info
  const walletInfo = createWalletInfo(mnemonic, protocol);

  // Display master public key
  displayMasterPublicKey(walletInfo.masterPublicKey, protocol);

  // Step 3: Derivation index range
  const { startIndex, count } = await inquirer.prompt([
    {
      type: 'number',
      name: 'startIndex',
      message: 'Starting derivation index:',
      default: 0,
      validate: (input: number) => input >= 0 || 'Must be >= 0',
    },
    {
      type: 'number',
      name: 'count',
      message: 'Number of addresses to generate:',
      default: 10,
      validate: (input: number) =>
        (input > 0 && input <= 1000) || 'Must be between 1 and 1000',
    },
  ]);

  // Step 4: Advanced options (custom path)
  const { useCustomPath } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useCustomPath',
      message: 'Use custom derivation path?',
      default: false,
    },
  ]);

  let customPath: string | undefined;
  if (useCustomPath) {
    const { inputPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputPath',
        message: 'Enter custom path (use {index} as placeholder):',
        default: protocol === 'evm' ? "m/44'/60'/0'/0/{index}" : "m/44'/195'/0'/0/{index}",
      },
    ]);
    customPath = inputPath;
  }

  // Step 5: Confirmation
  console.log(chalk.bold('\n📋 Generation Summary:'));
  console.log(chalk.white(`   Protocol: ${protocol.toUpperCase()}`));
  console.log(
    chalk.white(
      `   Derivation Path: ${customPath || (protocol === 'evm' ? "m/44'/60'/0'/0/{index}" : "m/44'/195'/0'/0/{index}")}`
    )
  );
  console.log(chalk.white(`   Index Range: ${startIndex} - ${startIndex + count - 1}`));
  console.log(chalk.white(`   Total Addresses: ${count}`));
  console.log(chalk.white(`   Master Public Key: ${walletInfo.masterPublicKey.substring(0, 20)}...`));

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Proceed with generation?',
      default: true,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.yellow('\n⚠️  Generation cancelled\n'));
    return;
  }

  // Generate addresses
  const spinner = ora('Generating addresses...').start();

  try {
    const generated = generateAddresses(protocol, mnemonic, startIndex, count, customPath);

    spinner.succeed('Address generation complete');

    // Prepare CSV data
    const csvData: AddressData[] = generated.map(addr => ({
      address: addr.address,
      derivationIndex: addr.derivationIndex,
      protocol,
      masterPublicKey: walletInfo.masterPublicKey,
    }));

    // Display summary
    displayGenerationSummary(count, startIndex, startIndex + count - 1, protocol);

    // Export to CSV
    const { shouldExport } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldExport',
        message: 'Export to CSV file?',
        default: true,
      },
    ]);

    if (shouldExport) {
      const csvContent = exportToCSV(csvData, protocol);
      const filename = generateFilename(protocol, 'full');
      const outputDir = join(process.cwd(), 'output');
      const fullPath = join(outputDir, filename);

      // Ensure output directory exists
      try {
        const { mkdirSync } = await import('fs');
        mkdirSync(outputDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      writeFileSync(fullPath, csvContent, 'utf-8');
      displayFileSaved(filename, fullPath);
    }

    // Display important reminders
    console.log(chalk.yellow.bold('\n⚠️  Important Reminders:'));
    console.log(chalk.white('   1. Securely backup your mnemonic phrase'));
    console.log(chalk.white('   2. Keep CSV file safe (contains derivation info)'));
    console.log(chalk.white('   3. This tool did NOT save your mnemonic'));
    console.log(chalk.white('   4. CSV can be imported to PayIn Admin UI\n'));
  } catch (error) {
    spinner.fail('Generation failed');
    console.error(chalk.red('\n❌ Error:'), error);
  }
}
