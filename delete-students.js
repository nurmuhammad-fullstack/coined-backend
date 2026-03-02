// delete-students.js — Run to delete all students except one for testing
// Usage: node delete-students.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const connectDB = require('./config/db');

const deleteStudents = async () => {
  await connectDB();

  // Find the student we'll keep (Alex Thompson - first seed student)
  const keepStudent = await User.findOne({ email: 'alex@school.uz' });
  
  if (keepStudent) {
    console.log(`✅ Keeping test student: ${keepStudent.name} (${keepStudent.email})`);
    
    // Delete all other students
    const result = await User.deleteMany({ 
      role: 'student', 
      _id: { $ne: keepStudent._id } 
    });
    
    console.log(`🗑️  Deleted ${result.deletedCount} students`);
  } else {
    // If no Alex, keep the first student found
    const firstStudent = await User.findOne({ role: 'student' });
    if (firstStudent) {
      console.log(`✅ Keeping test student: ${firstStudent.name} (${firstStudent.email})`);
      
      const result = await User.deleteMany({ 
        role: 'student', 
        _id: { $ne: firstStudent._id } 
      });
      
      console.log(`🗑️  Deleted ${result.deletedCount} students`);
    } else {
      console.log('ℹ️  No students found in database');
    }
  }

  // Show remaining students
  const remaining = await User.find({ role: 'student' });
  console.log(`\n📋 Remaining students: ${remaining.length}`);
  remaining.forEach(s => console.log(`   - ${s.name} (${s.email})`));

  console.log('\n✅ Done!');
  process.exit(0);
};

deleteStudents().catch(err => { 
  console.error(err); 
  process.exit(1); 
});

