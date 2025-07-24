import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSuperAdmin() {
  try {
    // Try to find superadmin by username first, then fallback to email or role
    let superadmin = null;
    
    try {
      superadmin = await prisma.user.findUnique({
        where: { username: 'superadmin' }
      });
    } catch (usernameError) {
      console.log('Username field not available, trying alternative methods...');
    }
    
    // If not found by username, try by email or role
    if (!superadmin) {
      superadmin = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'superadmin@example.com' },
            { role: 'SUPERADMIN' }
          ]
        }
      });
    }
    
    if (superadmin) {
      console.log('✅ Superadmin user found:');
      console.log(`Username: ${superadmin.username || 'N/A'}`);
      console.log(`Email: ${superadmin.email}`);
      console.log(`Name: ${superadmin.name}`);
      console.log(`Role: ${superadmin.role}`);
      if (superadmin.department) {
        console.log(`Department: ${superadmin.department}`);
      }
      if (superadmin.superadminVerifyCode) {
        console.log(`Verification Code: ${superadmin.superadminVerifyCode}`);
      }
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