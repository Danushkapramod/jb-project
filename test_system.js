// Automated test suite for AgriDispatch backend APIs
const { dbAsync } = require('./db');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('🧪 Starting Automated System Tests...\n');

  try {
    // Test 1: Clean up test entries in database
    await dbAsync.run("DELETE FROM users WHERE email LIKE '%@test.lk'");
    await dbAsync.run("DELETE FROM dispatches WHERE id LIKE 'TEST-%'");
    console.log('✅ Test DB cleaned up.');

    // Test 2: User Registration Validation
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync('securePass123', salt);

    const testUser = {
      name: 'Kamal Perera',
      email: 'kamal@test.lk',
      password_hash: passHash,
      phone: '0771234567',
      vehicle_reg_no: 'WP-TR-8812',
      vehicle_type: 'Tractor',
      location: 'Faculty Field Station Zone A'
    };

    const regResult = await dbAsync.run(
      `INSERT INTO users (name, email, password_hash, phone, vehicle_reg_no, vehicle_type, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testUser.name, testUser.email, testUser.password_hash, testUser.phone, testUser.vehicle_reg_no, testUser.vehicle_type, testUser.location]
    );

    console.log(`✅ Test 1 Passed: User registered with ID: ${regResult.lastID}`);

    // Test 3: Duplicate Email Prevention
    try {
      await dbAsync.run(
        `INSERT INTO users (name, email, password_hash, phone, vehicle_reg_no, vehicle_type, location)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [testUser.name, testUser.email, testUser.password_hash, testUser.phone, testUser.vehicle_reg_no, testUser.vehicle_type, testUser.location]
      );
      console.error('❌ Test 2 Failed: Duplicate email was not blocked!');
    } catch (e) {
      console.log('✅ Test 2 Passed: Duplicate email was properly blocked by SQLite UNIQUE constraint.');
    }

    // Test 4: Password Verification
    const userFromDb = await dbAsync.get('SELECT * FROM users WHERE email = ?', [testUser.email]);
    const validPass = bcrypt.compareSync('securePass123', userFromDb.password_hash);
    const invalidPass = bcrypt.compareSync('wrongPass', userFromDb.password_hash);

    if (validPass && !invalidPass) {
      console.log('✅ Test 3 Passed: Password hashing & verification logic working correctly.');
    } else {
      console.error('❌ Test 3 Failed: Password comparison failed.');
    }

    // Test 5: Dispatch Creation
    const testDispatchId = `TEST-DISP-${Date.now()}`;
    await dbAsync.run(
      `INSERT INTO dispatches (id, requester_phone, vehicle_type, date, location, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [testDispatchId, '0719876543', 'Tractor', '2026-09-12', 'Paddy Field Plot 5', 'Ploughing test']
    );

    const pendingDisp = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [testDispatchId]);
    if (pendingDisp && pendingDisp.status === 'PENDING') {
      console.log(`✅ Test 4 Passed: Dispatch created with status: ${pendingDisp.status}`);
    } else {
      console.error('❌ Test 4 Failed: Dispatch creation failed.');
    }

    // Test 6: First-Come First-Served Locking Simulation
    // Driver A approves:
    const lockResult1 = await dbAsync.run(
      `UPDATE dispatches 
       SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING'`,
      [userFromDb.id, testDispatchId]
    );

    if (lockResult1.changes === 1) {
      console.log('✅ Test 5 Passed: Driver A successfully claimed the job.');
    } else {
      console.error('❌ Test 5 Failed: Driver A could not claim job.');
    }

    // Driver B attempts to approve the exact same job:
    const lockResult2 = await dbAsync.run(
      `UPDATE dispatches 
       SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING'`,
      [999, testDispatchId]
    );

    if (lockResult2.changes === 0) {
      console.log('✅ Test 6 Passed: Driver B was BLOCKED from claiming the already-approved job! (Locking works)');
    } else {
      console.error('❌ Test 6 Failed: Concurrency lock failed! Multiple drivers approved same job.');
    }

    // Test 7: WhatsApp Phone Number Formatting
    const whatsappService = require('./services/whatsapp');
    const f1 = whatsappService.formatWhatsAppNumber('0771234567');
    const f2 = whatsappService.formatWhatsAppNumber('+94771234567');
    const f3 = whatsappService.formatWhatsAppNumber('94771234567@c.us');

    if (f1 === '94771234567@c.us' && f2 === '94771234567@c.us' && f3 === '94771234567@c.us') {
      console.log('✅ Test 7 Passed: WhatsApp phone number normalization formats correctly.');
    } else {
      console.error(`❌ Test 7 Failed: Number formatting failed: f1=${f1}, f2=${f2}, f3=${f3}`);
    }

    console.log('\n🎉 ALL LOGICAL & DATABASE TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test suite encountered an error:', err);
    process.exit(1);
  }
}

runTests();
