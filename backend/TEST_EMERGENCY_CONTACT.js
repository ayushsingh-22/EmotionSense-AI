/**
 * Emergency Contact System - Test Cases & Examples
 *
 * This file contains comprehensive test cases for the emergency contact system.
 * Run individual tests to validate functionality.
 *
 * Usage:
 *   node TEST_EMERGENCY_CONTACT.js
 */

import { sendEmergencyAlert, sendTestEmail, verifyEmailConfig } from './src/utils/emailAlert.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
};

/**
 * Test Suite 1: Email Configuration
 */
async function testEmailConfiguration() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 1: Email Configuration');
  console.log('='.repeat(60));

  try {
    log.info('Verifying email configuration...');
    const isValid = await verifyEmailConfig();

    if (isValid) {
      log.success('Email configuration is valid and ready to use');
      return true;
    } else {
      log.error('Email configuration failed verification');
      return false;
    }
  } catch (error) {
    log.error(`Email configuration test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Suite 2: Send Test Email
 */
async function testSendEmail() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 2: Send Test Email');
  console.log('='.repeat(60));

  const testEmail = process.env.TEST_EMAIL || 'test@example.com';

  log.warn(`Using test email: ${testEmail}`);
  log.info('This test will attempt to send a test email...');

  try {
    const result = await sendTestEmail(testEmail);

    if (result) {
      log.success(`Test email sent successfully to ${testEmail}`);
      log.info('Check your inbox for the test email');
      return true;
    } else {
      log.error('Failed to send test email');
      return false;
    }
  } catch (error) {
    log.error(`Send test email failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Suite 3: Emergency Alert Email
 */
async function testEmergencyAlert() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 3: Emergency Alert Email');
  console.log('='.repeat(60));

  // Mock user and contact objects
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    full_name: 'Test User',
    email: 'testuser@example.com',
  };

  const mockContact = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    user_id: mockUser.id,
    contact_name: 'Emergency Contact Name',
    contact_email: process.env.TEST_EMERGENCY_EMAIL || 'emergency@example.com',
    contact_phone: '+1 (555) 123-4567',
    preferred_method: 'email',
    notify_enabled: true,
  };

  const emotions = ['sad', 'angry', 'fear', 'distress'];
  const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

  log.info(`Mock User: ${mockUser.full_name} (${mockUser.email})`);
  log.info(`Mock Contact: ${mockContact.contact_name} (${mockContact.contact_email})`);
  log.info(`Test Emotion: ${randomEmotion}`);

  try {
    const result = await sendEmergencyAlert(
      mockUser,
      mockContact,
      randomEmotion,
      new Date()
    );

    if (result) {
      log.success('Emergency alert email sent successfully');
      log.info(`Check ${mockContact.contact_email} inbox for the alert`);
      return true;
    } else {
      log.error('Failed to send emergency alert');
      return false;
    }
  } catch (error) {
    log.error(`Emergency alert test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Suite 4: Supabase Connection
 */
async function testSupabaseConnection() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 4: Supabase Connection');
  console.log('='.repeat(60));

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('Missing Supabase credentials in .env');
    return false;
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    log.info('Attempting to connect to Supabase...');

    // Try to query a simple count
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*', { count: 'exact', head: true });

    if (error && error.code !== 'PGRST116') {
      log.error(`Supabase connection failed: ${error.message}`);
      return false;
    }

    log.success('Successfully connected to Supabase');
    log.info(`Table "emergency_contacts" is accessible`);
    return true;
  } catch (error) {
    log.error(`Supabase connection test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Suite 5: Input Validation
 */
function testInputValidation() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 5: Input Validation');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: 'Valid Email',
      email: 'test@example.com',
      shouldPass: true,
    },
    {
      name: 'Invalid Email - No @',
      email: 'testexample.com',
      shouldPass: false,
    },
    {
      name: 'Invalid Email - No Domain',
      email: 'test@',
      shouldPass: false,
    },
    {
      name: 'Valid Phone',
      phone: '+1 (555) 123-4567',
      shouldPass: true,
    },
    {
      name: 'Invalid Phone - Too Short',
      phone: '123',
      shouldPass: false,
    },
    {
      name: 'Valid Phone - Letters',
      phone: '+1-555-123-4567',
      shouldPass: true,
    },
  ];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\d\s+\-()]{10,}$/;

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase) => {
    let result;

    if (testCase.email) {
      result = emailRegex.test(testCase.email) === testCase.shouldPass;
      const actual = emailRegex.test(testCase.email);
      const status = result ? '✓' : '✗';
      console.log(`  ${status} ${testCase.name}: "${testCase.email}" (${actual})`);
    } else if (testCase.phone) {
      result = phoneRegex.test(testCase.phone) === testCase.shouldPass;
      const actual = phoneRegex.test(testCase.phone);
      const status = result ? '✓' : '✗';
      console.log(`  ${status} ${testCase.name}: "${testCase.phone}" (${actual})`);
    }

    if (result) {
      passed++;
    } else {
      failed++;
    }
  });

  if (failed === 0) {
    log.success(`All ${passed} validation tests passed`);
    return true;
  } else {
    log.error(`${failed} validation tests failed, ${passed} passed`);
    return false;
  }
}

/**
 * Test Suite 6: Emergency Contact Payload Validation
 */
function testPayloadValidation() {
  console.log('\n' + '='.repeat(60));
  log.test('Test Suite 6: Emergency Contact Payload Validation');
  console.log('='.repeat(60));

  const testPayloads = [
    {
      name: 'Valid Payload',
      payload: {
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
        contact_phone: '+1 (555) 123-4567',
        preferred_method: 'email',
        notify_enabled: true,
      },
      shouldPass: true,
    },
    {
      name: 'Missing Name',
      payload: {
        contact_email: 'john@example.com',
        preferred_method: 'email',
      },
      shouldPass: false,
    },
    {
      name: 'Missing Email',
      payload: {
        contact_name: 'John Doe',
        preferred_method: 'email',
      },
      shouldPass: false,
    },
    {
      name: 'Invalid Email Format',
      payload: {
        contact_name: 'John Doe',
        contact_email: 'invalid-email',
        preferred_method: 'email',
      },
      shouldPass: false,
    },
    {
      name: 'Minimal Valid Payload',
      payload: {
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
      },
      shouldPass: true,
    },
  ];

  const validatePayload = (payload) => {
    if (!payload.contact_name || typeof payload.contact_name !== 'string') {
      return false;
    }
    if (!payload.contact_email || typeof payload.contact_email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.contact_email)) {
      return false;
    }
    return true;
  };

  let passed = 0;
  let failed = 0;

  testPayloads.forEach((test) => {
    const isValid = validatePayload(test.payload);
    const result = isValid === test.shouldPass;
    const status = result ? '✓' : '✗';

    console.log(`  ${status} ${test.name}`);
    if (!result) {
      console.log(`      Expected: ${test.shouldPass}, Got: ${isValid}`);
    }

    if (result) {
      passed++;
    } else {
      failed++;
    }
  });

  if (failed === 0) {
    log.success(`All ${passed} payload validation tests passed`);
    return true;
  } else {
    log.error(`${failed} payload tests failed, ${passed} passed`);
    return false;
  }
}

/**
 * Run All Tests
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' Emergency Contact System - Test Suite '.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const results = {
    'Email Configuration': null,
    'Send Test Email': null,
    'Emergency Alert': null,
    'Supabase Connection': null,
    'Input Validation': null,
    'Payload Validation': null,
  };

  // Run tests
  results['Email Configuration'] = await testEmailConfiguration();
  results['Send Test Email'] = await testSendEmail();
  results['Emergency Alert'] = await testEmergencyAlert();
  results['Supabase Connection'] = await testSupabaseConnection();
  results['Input Validation'] = testInputValidation();
  results['Payload Validation'] = testPayloadValidation();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  Object.entries(results).forEach(([testName, result]) => {
    if (result === true) {
      console.log(`${colors.green}✅ ${testName}${colors.reset}`);
      totalPassed++;
    } else if (result === false) {
      console.log(`${colors.red}❌ ${testName}${colors.reset}`);
      totalFailed++;
    } else {
      console.log(`${colors.yellow}⚠️  ${testName} - No Result${colors.reset}`);
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed\n`);

  if (totalFailed === 0) {
    log.success('All tests passed! System is ready for use.');
  } else {
    log.error(`${totalFailed} test(s) failed. Please review the issues above.`);
  }
}

/**
 * Interactive Test Mode
 */
async function interactiveMode() {
  console.log('\n' + '='.repeat(60));
  console.log('INTERACTIVE TEST MODE');
  console.log('='.repeat(60));
  console.log('\nAvailable tests:');
  console.log('  1. Email Configuration Check');
  console.log('  2. Send Test Email');
  console.log('  3. Send Emergency Alert');
  console.log('  4. Supabase Connection Check');
  console.log('  5. Input Validation Tests');
  console.log('  6. Payload Validation Tests');
  console.log('  7. Run All Tests');
  console.log('  8. Exit');
  console.log('\nNote: Set TEST_EMAIL and TEST_EMERGENCY_EMAIL in .env for tests 2 & 3');
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  await runAllTests();
} else if (args[0] === 'interactive') {
  interactiveMode();
} else if (args[0] === '1') {
  await testEmailConfiguration();
} else if (args[0] === '2') {
  await testSendEmail();
} else if (args[0] === '3') {
  await testEmergencyAlert();
} else if (args[0] === '4') {
  await testSupabaseConnection();
} else if (args[0] === '5') {
  testInputValidation();
} else if (args[0] === '6') {
  testPayloadValidation();
} else {
  console.log('Usage:');
  console.log('  node TEST_EMERGENCY_CONTACT.js          - Run all tests');
  console.log('  node TEST_EMERGENCY_CONTACT.js 1        - Test email config');
  console.log('  node TEST_EMERGENCY_CONTACT.js 2        - Send test email');
  console.log('  node TEST_EMERGENCY_CONTACT.js 3        - Send emergency alert');
  console.log('  node TEST_EMERGENCY_CONTACT.js 4        - Test Supabase connection');
  console.log('  node TEST_EMERGENCY_CONTACT.js 5        - Test input validation');
  console.log('  node TEST_EMERGENCY_CONTACT.js 6        - Test payload validation');
  console.log('  node TEST_EMERGENCY_CONTACT.js interactive - Interactive mode');
}
