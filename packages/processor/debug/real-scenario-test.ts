#!/usr/bin/env tsx

/**
 * Debug script to test the exact scenario from the logs
 */

import { AmountAccumulator } from '../src/core/amount-accumulator.js';

function convertWeiToDecimal(weiAmount: string, currency: string): string {
  const amount = parseFloat(weiAmount);
  const decimals: { [key: string]: number } = {
    'USDC': 6, 'USDT': 6, 'DAI': 18, 'ETH': 18
  };
  const tokenDecimals = decimals[currency] || 6;
  const divisor = Math.pow(10, tokenDecimals);
  const decimalAmount = amount / divisor;
  return decimalAmount.toFixed(6);
}

function testRealScenario() {
  console.log('🔬 Testing exact scenario from logs...\n');

  // Exact values from the logs
  const weiAmount = '50000'; // From blockchain
  const currency = 'USDC';
  const currentReceived = '0.000000';
  const requiredAmount = '0.050000';

  console.log('📊 Input values (from logs):');
  console.log(`   Wei amount: ${weiAmount}`);
  console.log(`   Currency: ${currency}`);
  console.log(`   Current received: ${currentReceived}`);
  console.log(`   Required amount: ${requiredAmount}`);

  // Step 1: Convert wei to decimal (as done in the real code)
  const transferAmountDecimal = convertWeiToDecimal(weiAmount, currency);
  console.log(`\n🔄 Wei conversion:`);
  console.log(`   ${weiAmount} wei -> ${transferAmountDecimal} ${currency}`);

  // Step 2: Create mock order (matching ExtendedOrderRecord structure)
  const mockOrder = {
    id: 'test-order',
    required_amount: requiredAmount,  // Note: underscore version
    received_amount: currentReceived, // Note: underscore version
    receivedTransactions: [],
    requiredAmount, // Note: camelCase version for AmountAccumulator
    receivedAmount: currentReceived, // Note: camelCase version for AmountAccumulator
    version: 2
  } as any;

  console.log(`\n📋 Mock order:`);
  console.log(`   required_amount (db): ${mockOrder.required_amount}`);
  console.log(`   received_amount (db): ${mockOrder.received_amount}`);
  console.log(`   requiredAmount (obj): ${mockOrder.requiredAmount}`);
  console.log(`   receivedAmount (obj): ${mockOrder.receivedAmount}`);

  // Step 3: Test addAmounts function directly
  console.log(`\n🔧 Testing addAmounts function:`);
  const { addAmounts, compareAmounts } = require('../src/core/order-state-machine.js');
  const newTotal = addAmounts(currentReceived, transferAmountDecimal);
  console.log(`   addAmounts('${currentReceived}', '${transferAmountDecimal}') = ${newTotal}`);
  
  const comparison = compareAmounts(newTotal, requiredAmount);
  console.log(`   compareAmounts('${newTotal}', '${requiredAmount}') = ${comparison}`);
  console.log(`   Is overpaid? ${comparison > 0}`);

  // Step 4: Run through AmountAccumulator
  const accumulator = new AmountAccumulator();
  const result = accumulator.addTransaction(
    mockOrder, 
    '0xa93f90215b03cd6bdbab0ee4c7cb3511000b327f83bfbeb65ec0972a99ae3a38',
    transferAmountDecimal,
    9135208
  );

  console.log(`\n💰 AmountAccumulator result:`);
  console.log(`   New received amount: ${result.newReceivedAmount}`);
  console.log(`   Is amount sufficient: ${result.isAmountSufficient}`);
  console.log(`   Is overpaid: ${result.isOverpaid}`);

  console.log(`\n🔍 Debug calculations:`);
  const newTotal = parseFloat(currentReceived) + parseFloat(transferAmountDecimal);
  console.log(`   Manual calculation: ${currentReceived} + ${transferAmountDecimal} = ${newTotal.toFixed(6)}`);
  console.log(`   Required: ${parseFloat(requiredAmount)}`);
  console.log(`   Difference: ${newTotal - parseFloat(requiredAmount)}`);
  console.log(`   Is exactly equal: ${newTotal === parseFloat(requiredAmount)}`);

  // Test potential data type issues
  console.log(`\n🧪 Data type analysis:`);
  console.log(`   typeof transferAmountDecimal: ${typeof transferAmountDecimal}`);
  console.log(`   typeof requiredAmount: ${typeof requiredAmount}`);
  console.log(`   typeof currentReceived: ${typeof currentReceived}`);
  console.log(`   transferAmountDecimal === requiredAmount: ${transferAmountDecimal === requiredAmount}`);
  console.log(`   parseFloat(transferAmountDecimal) === parseFloat(requiredAmount): ${parseFloat(transferAmountDecimal) === parseFloat(requiredAmount)}`);
}

testRealScenario();