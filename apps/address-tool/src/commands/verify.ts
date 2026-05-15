/**
 * Verify address command
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import type { Protocol } from '../types.js';
import { createOrImportMnemonic, verifyAddress } from '../utils/wallet.js';
import { displayVerificationResult } from '../utils/security.js';

export async function verifyCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n✅ Verify Address Ownership\n'));

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

  // Step 2: Input mnemonic
  const { mnemonicPhrase } = await inquirer.prompt([
    {
      type: 'password',
      name: 'mnemonicPhrase',
      message: 'Enter mnemonic phrase or extended public key (xpub):',
      mask: '*',
      validate: (input: string) => {
        const trimmed = input.trim();
        // Check if it's a mnemonic (12 or 24 words) or xpub
        const words = trimmed.split(/\s+/);
        if (words.length === 12 || words.length === 24) {
          return true;
        }
        if (trimmed.startsWith('xpub') || trimmed.startsWith('tpub')) {
          // For now, we only support mnemonic. xpub support can be added later
          return 'Extended public key (xpub) support is coming soon. Please use mnemonic phrase.';
        }
        return 'Please enter a valid 12 or 24 word mnemonic phrase';
      },
    },
  ]);

  const mnemonic = createOrImportMnemonic(mnemonicPhrase);

  // Step 3: Input address to verify
  const { address } = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter address to verify:',
      validate: (input: string) => {
        const trimmed = input.trim();
        if (protocol === 'evm') {
          if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
            return true;
          }
          return 'Invalid EVM address format (should be 0x followed by 40 hex characters)';
        } else if (protocol === 'tron') {
          if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) {
            return true;
          }
          return 'Invalid Tron address format (should start with T and be 34 characters)';
        }
        return 'Invalid address format';
      },
    },
  ]);

  // Step 4: Search range
  const { searchRange } = await inquirer.prompt([
    {
      type: 'number',
      name: 'searchRange',
      message: 'Search range (how many indices to check):',
      default: 1000,
      validate: (input: number) =>
        (input > 0 && input <= 10000) || 'Must be between 1 and 10000',
    },
  ]);

  // Verify address
  const spinner = ora(`Searching... (range: 0-${searchRange - 1})`).start();

  try {
    const result = verifyAddress(protocol, mnemonic, address.trim(), searchRange);

    spinner.stop();

    displayVerificationResult(result.found, address.trim(), result.index, result.path);

    // Ask if user wants to verify another address
    const { verifyAnother } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'verifyAnother',
        message: 'Verify another address with the same wallet?',
        default: false,
      },
    ]);

    if (verifyAnother) {
      // Recursively call verify command with same mnemonic
      // For simplicity, we'll just prompt for address again
      const verifyMore = async () => {
        const { nextAddress } = await inquirer.prompt([
          {
            type: 'input',
            name: 'nextAddress',
            message: 'Enter address to verify:',
            validate: (input: string) => {
              const trimmed = input.trim();
              if (protocol === 'evm') {
                return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || 'Invalid EVM address format';
              } else if (protocol === 'tron') {
                return /^T[a-zA-Z0-9]{33}$/.test(trimmed) || 'Invalid Tron address format';
              }
              return 'Invalid address format';
            },
          },
        ]);

        const spinner2 = ora(`Searching... (range: 0-${searchRange - 1})`).start();
        const result2 = verifyAddress(protocol, mnemonic, nextAddress.trim(), searchRange);
        spinner2.stop();

        displayVerificationResult(result2.found, nextAddress.trim(), result2.index, result2.path);

        const { continueVerifying } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueVerifying',
            message: 'Verify another address?',
            default: false,
          },
        ]);

        if (continueVerifying) {
          await verifyMore();
        }
      };

      await verifyMore();
    }
  } catch (error) {
    spinner.fail('Verification failed');
    console.error(chalk.red('\n❌ Error:'), error);
  }
}
