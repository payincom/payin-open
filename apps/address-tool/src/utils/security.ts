/**
 * Security warnings and prompts
 */

import chalk from 'chalk';

/**
 * Display security warning about offline operation
 */
export function displaySecurityWarning(): void {
  console.log('\n' + chalk.yellow.bold('⚠️  SECURITY WARNING'));
  console.log(chalk.yellow('━'.repeat(70)));
  console.log(chalk.white('This tool handles sensitive mnemonic phrases and private keys.'));
  console.log(chalk.white('It is STRONGLY RECOMMENDED to use in an offline environment:'));
  console.log('');
  console.log(chalk.cyan('  1. Disconnect from network'));
  console.log(chalk.cyan('  2. Complete address generation and export'));
  console.log(chalk.cyan('  3. Securely save mnemonic and CSV files'));
  console.log(chalk.cyan('  4. Reconnect to network'));
  console.log('');
  console.log(chalk.white('For Phase 2 features (balance check, fund collection),'));
  console.log(chalk.white('network connection is required but mnemonic is never transmitted.'));
  console.log(chalk.white('All signing operations occur locally.'));
  console.log(chalk.yellow('━'.repeat(70)) + '\n');
}

/**
 * Display mnemonic with warning
 */
export function displayMnemonic(mnemonic: string, isNew: boolean = true): void {
  console.log('\n' + chalk.red.bold('🔐 MNEMONIC PHRASE (KEEP SAFE!)'));
  console.log(chalk.red('━'.repeat(70)));
  console.log(chalk.white.bold(mnemonic));
  console.log(chalk.red('━'.repeat(70)));

  if (isNew) {
    console.log(chalk.yellow('\n⚠️  This is your NEW mnemonic phrase!'));
    console.log(chalk.yellow('   Write it down and store it in a safe place.'));
    console.log(chalk.yellow('   Anyone with this phrase can access your funds.'));
    console.log(chalk.yellow('   This tool will NOT save it for you.\n'));
  } else {
    console.log(chalk.green('\n✓ Mnemonic loaded successfully\n'));
  }
}

/**
 * Display master public key
 */
export function displayMasterPublicKey(xpub: string, protocol: string): void {
  console.log(chalk.cyan.bold(`\n📋 Master Public Key (${protocol.toUpperCase()}):`));
  console.log(chalk.white(xpub));
  console.log(chalk.gray('(Safe to share - used for read-only address derivation)\n'));
}

/**
 * Display generation progress
 */
export function displayGenerationSummary(
  count: number,
  startIndex: number,
  endIndex: number,
  protocol: string
): void {
  console.log(chalk.green.bold('\n✅ Address Generation Complete!'));
  console.log(chalk.white(`   Generated ${count} ${protocol.toUpperCase()} addresses`));
  console.log(chalk.white(`   Derivation index range: ${startIndex} - ${endIndex}`));
}

/**
 * Display file saved message
 */
export function displayFileSaved(filename: string, fullPath: string): void {
  console.log(chalk.green.bold('\n💾 File Saved!'));
  console.log(chalk.white(`   Filename: ${filename}`));
  console.log(chalk.white(`   Location: ${fullPath}`));
  console.log(chalk.cyan('\n💡 This CSV file can be imported to PayIn Admin UI'));
}

/**
 * Display verification result
 */
export function displayVerificationResult(
  found: boolean,
  address: string,
  index?: number,
  path?: string
): void {
  console.log('');
  if (found && index !== undefined && path) {
    console.log(chalk.green.bold('✅ Address Verified!'));
    console.log(chalk.white(`   Address: ${address}`));
    console.log(chalk.white(`   Belongs to current wallet`));
    console.log(chalk.white(`   Derivation Index: ${index}`));
    console.log(chalk.white(`   Derivation Path: ${path}`));
  } else {
    console.log(chalk.red.bold('❌ Address Not Found'));
    console.log(chalk.white(`   Address: ${address}`));
    console.log(chalk.white(`   Does not belong to current wallet`));
    console.log(chalk.gray(`   (Searched range: 0-1000)`));
  }
  console.log('');
}

/**
 * Display coming soon message
 */
export function displayComingSoon(feature: string): void {
  console.log('\n' + chalk.blue.bold(`🚧 ${feature} - Coming Soon!`));
  console.log(chalk.gray('   This feature is planned for Phase 2\n'));
}
