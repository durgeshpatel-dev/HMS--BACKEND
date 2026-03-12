import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER' }
  });
  
  console.log(`\nManager users: ${managers.length}`);
  managers.forEach(u => {
    console.log(`- ${u.name} (${u.email})`);
  });
  
  await prisma.$disconnect();
}

checkUsers();
