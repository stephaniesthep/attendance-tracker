import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSuperAdmin() {
  try {
    const superadmin = await prisma.user.findUnique({
      where: { username: 'superadmin' }
    });
    
    if (superadmin) {
      console.log('✅ Superadmin user found:');
      console.log(`Username: ${superadmin.username}`);
      console.log(`Name: ${superadmin.name}`);
      console.log(`Role: ${superadmin.role}`);
      console.log(`Department: ${superadmin.department}`);
      console.log(`Verification Code: ${superadmin.superadminVerifyCode}`);
    } else {
      console.log('❌ Superadmin user not found');
    }
  } catch (error) {
    console.error('Error checking superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuperAdmin();