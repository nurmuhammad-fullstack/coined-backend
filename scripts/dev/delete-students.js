require('dotenv').config();

const User = require('../../models/User');
const connectDB = require('../../config/db');

const ensureDevelopmentMode = () => {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    throw new Error('scripts/dev/delete-students.js can only run when NODE_ENV is development');
  }
};

const deleteStudents = async () => {
  ensureDevelopmentMode();
  await connectDB();

  const firstStudent = await User.findOne({ role: 'student' }).sort({ createdAt: 1 });
  if (!firstStudent) {
    console.log('No students found');
    process.exit(0);
  }

  console.log(`Keeping demo student: ${firstStudent.name} (${firstStudent.email})`);

  const result = await User.deleteMany({
    role: 'student',
    _id: { $ne: firstStudent._id },
  });

  console.log(`Deleted ${result.deletedCount} students`);

  const remaining = await User.find({ role: 'student' });
  console.log(`Remaining students: ${remaining.length}`);
  remaining.forEach((student) => {
    console.log(` - ${student.name} (${student.email})`);
  });

  process.exit(0);
};

deleteStudents().catch((err) => {
  console.error(err);
  process.exit(1);
});
