#!/usr/bin/env tsx

/**
 * Debug script to test amount comparison logic
 */

import { compareAmounts } from '../src/core/order-state-machine.js';
import { AmountAccumulator } from '../src/core/amount-accumulator.js';

function testAmountComparison() {
  console.log('🔬 Testing amount comparison logic...\n');

  // Test the exact values from the log
  const receivedAmount = '0.050000';
  const requiredAmount = '0.050000';
  const transferAmount = '0.050000';

  console.log('📊 Test values:');
  console.log(`   Received: ${receivedAmount}`);
  console.log(`   Required: ${requiredAmount}`);
  console.log(`   Transfer: ${transferAmount}`);

  // Test compareAmounts function directly
  console.log('\n🔍 Direct compareAmounts tests:');
  const comparison = compareAmounts(receivedAmount, requiredAmount);
  console.log(`   compareAmounts('${receivedAmount}', '${requiredAmount}') = ${comparison}`);
  console.log(`   Expected: 0 (equal)`);
  console.log(`   Is equal? ${comparison === 0}`);
  console.log(`   Is overpaid? ${comparison > 0}`);

  // Test edge cases
  console.log('\n🧪 Edge case tests:');
  const testCases = [
    ['0.050000', '0.050000'], // Exact match
    ['0.050001', '0.050000'], // Slightly over
    ['0.049999', '0.050000'], // Slightly under
    ['0.050000000001', '0.050000'], // Very close over
    ['0.049999999999', '0.050000'], // Very close under
  ];

  testCases.forEach(([amount1, amount2]) => {
    const result = compareAmounts(amount1, amount2);
    console.log(`   compareAmounts('${amount1}', '${amount2}') = ${result} (${result === 0 ? 'equal' : result > 0 ? 'greater' : 'less'})`);
  });

  // Test AmountAccumulator
  console.log('\n💰 Testing AmountAccumulator...');
  const accumulator = new AmountAccumulator();
  
  // Mock order object
  const mockOrder = {
    id: 'test-order',
    requiredAmount: '0.050000',
    receivedAmount: '0.000000',
    receivedTransactions: [],
    version: 1
  } as any;

  const result = accumulator.addTransaction(mockOrder, 'test-tx', '0.050000', 12345);
  
  console.log('📈 AmountAccumulator result:');
  console.log(`   New received amount: ${result.newReceivedAmount}`);
  console.log(`   Is amount sufficient: ${result.isAmountSufficient}`);
  console.log(`   Is overpaid: ${result.isOverpaid}`);
  console.log(`   Expected isOverpaid: false`);

  // Test floating point precision
  console.log('\n🔢 Floating point precision test:');
  const float1 = parseFloat('0.050000');
  const float2 = parseFloat('0.050000');
  console.log(`   parseFloat('0.050000') = ${float1}`);
  console.log(`   parseFloat('0.050000') = ${float2}`);
  console.log(`   float1 === float2: ${float1 === float2}`);
  console.log(`   float1 - float2: ${float1 - float2}`);
  console.log(`   Math.abs(float1 - float2): ${Math.abs(float1 - float2)}`);
  console.log(`   Is within tolerance 1e-6: ${Math.abs(float1 - float2) <= 1e-6}`);
}

testAmountComparison();