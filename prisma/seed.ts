import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword, hashPin } from '../src/utils/bcrypt.util';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/restaurant_hms?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (development only)
  await prisma.payment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.table.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  console.log('✅ Cleared existing data\n');

  // Create Test Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'The Golden Spoon Restaurant',
      email: 'manager@goldenspoon.com',
      phone: '+91-9876543210',
      address: '123 Main Street, Mumbai, Maharashtra 400001, India',
      settings: {
        currency: 'INR',
        tax_percentage: 5,
        operating_hours: {
          monday: { open: '10:00', close: '22:00' },
          tuesday: { open: '10:00', close: '22:00' },
          wednesday: { open: '10:00', close: '22:00' },
          thursday: { open: '10:00', close: '22:00' },
          friday: { open: '10:00', close: '23:00' },
          saturday: { open: '10:00', close: '23:00' },
          sunday: { open: '10:00', close: '22:00' },
        },
        features: {
          table_service: true,
          parcel_orders: true,
          online_orders: false,
        },
      },
    },
  });

  console.log(`✅ Created restaurant: ${restaurant.name} (ID: ${restaurant.id})\n`);

  // Create Manager User
  const manager = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      email: 'manager@goldenspoon.com',
      passwordHash: await hashPassword('Manager@123'),
      name: 'Rajesh Kumar',
      phone: '+91-9876543210',
      role: 'manager',
      status: 'active',
    },
  });

  console.log(`✅ Created manager: ${manager.name} (Email: ${manager.email})\n`);

  // Create Staff Members
  const waiter1 = await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Amit Sharma',
      phone: '9876543211',
      pinHash: await hashPin('1234'),
      role: 'waiter',
      isActive: true,
    },
  });

  const waiter2 = await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Priya Singh',
      phone: '9876543212',
      pinHash: await hashPin('1234'),
      role: 'waiter',
      isActive: true,
    },
  });

  const cook1 = await prisma.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Suresh Patel',
      phone: '9876543213',
      pinHash: await hashPin('5678'),
      role: 'cook',
      isActive: true,
    },
  });

  console.log(`✅ Created staff members:`);
  console.log(`   - ${waiter1.name} (Waiter, Phone: ${waiter1.phone}, PIN: 1234)`);
  console.log(`   - ${waiter2.name} (Waiter, Phone: ${waiter2.phone}, PIN: 1234)`);
  console.log(`   - ${cook1.name} (Cook, Phone: ${cook1.phone}, PIN: 5678)\n`);

  // Create Menu Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Appetizers',
        description: 'Start your meal with these delicious appetizers',
        displayOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Main Course',
        description: 'Hearty main dishes to satisfy your hunger',
        displayOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Breads',
        description: 'Freshly baked Indian breads',
        displayOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Beverages',
        description: 'Refresh yourself with our drinks',
        displayOrder: 4,
      },
    }),
    prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Desserts',
        description: 'Sweet endings to your perfect meal',
        displayOrder: 5,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} menu categories\n`);

  // Create Menu Items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        name: 'Paneer Tikka',
        description: 'Grilled cottage cheese marinated in spices',
        price: 199,
        isAvailable: true,
        customizations: [
          { name: 'Spice Level', options: ['Mild', 'Medium', 'Spicy'] },
        ],
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        name: 'Vegetable Spring Rolls',
        description: 'Crispy rolls filled with fresh vegetables',
        price: 149,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        name: 'Chicken Wings',
        description: 'Spicy chicken wings with special sauce',
        price: 249,
        isAvailable: true,
        customizations: [
          { name: 'Sauce', options: ['BBQ', 'Hot & Spicy', 'Honey Mustard'] },
        ],
      },
    }),

    // Main Course
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Butter Chicken',
        description: 'Creamy tomato-based curry with tender chicken',
        price: 349,
        isAvailable: true,
        customizations: [
          { name: 'Spice Level', options: ['Mild', 'Medium', 'Spicy'] },
        ],
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Paneer Butter Masala',
        description: 'Rich curry with cottage cheese in creamy gravy',
        price: 299,
        isAvailable: true,
        customizations: [
          { name: 'Spice Level', options: ['Mild', 'Medium', 'Spicy'] },
        ],
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Dal Makhani',
        description: 'Black lentils cooked overnight with butter and cream',
        price: 249,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Biryani (Veg)',
        description: 'Aromatic rice cooked with vegetables and spices',
        price: 279,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Biryani (Chicken)',
        description: 'Aromatic rice cooked with chicken and spices',
        price: 349,
        isAvailable: true,
      },
    }),

    // Breads
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        name: 'Butter Naan',
        description: 'Soft leavened bread with butter',
        price: 49,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        name: 'Garlic Naan',
        description: 'Naan topped with garlic and coriander',
        price: 59,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        name: 'Tandoori Roti',
        description: 'Whole wheat bread cooked in tandoor',
        price: 39,
        isAvailable: true,
      },
    }),

    // Beverages
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[3].id,
        name: 'Fresh Lime Soda',
        description: 'Refreshing lime juice with soda',
        price: 69,
        isAvailable: true,
        customizations: [
          { name: 'Style', options: ['Sweet', 'Salt', 'Mixed'] },
        ],
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[3].id,
        name: 'Lassi',
        description: 'Traditional yogurt-based drink',
        price: 79,
        isAvailable: true,
        customizations: [
          { name: 'Flavor', options: ['Sweet', 'Salted', 'Mango'] },
        ],
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[3].id,
        name: 'Masala Chai',
        description: 'Traditional Indian tea with spices',
        price: 39,
        isAvailable: true,
      },
    }),

    // Desserts
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[4].id,
        name: 'Gulab Jamun',
        description: 'Soft milk dumplings in sugar syrup (2 pieces)',
        price: 89,
        isAvailable: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[4].id,
        name: 'Ice Cream',
        description: 'Choice of flavors',
        price: 99,
        isAvailable: true,
        customizations: [
          { name: 'Flavor', options: ['Vanilla', 'Chocolate', 'Mango', 'Strawberry'] },
        ],
      },
    }),
  ]);

  console.log(`✅ Created ${menuItems.length} menu items\n`);

  // Create Tables
  const tables = await Promise.all([
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T1',
        capacity: 2,
        location: 'Indoor',
        status: 'available',
      },
    }),
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T2',
        capacity: 4,
        location: 'Indoor',
        status: 'available',
      },
    }),
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T3',
        capacity: 4,
        location: 'Indoor',
        status: 'available',
      },
    }),
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T4',
        capacity: 6,
        location: 'Indoor',
        status: 'available',
      },
    }),
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T5',
        capacity: 8,
        location: 'VIP',
        status: 'available',
      },
    }),
    prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: 'T6',
        capacity: 4,
        location: 'Outdoor',
        status: 'available',
      },
    }),
  ]);

  console.log(`✅ Created ${tables.length} tables\n`);

  console.log('🎉 Database seeded successfully!\n');
  console.log('📋 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 Manager Login (Web Dashboard):');
  console.log(`   Email: ${manager.email}`);
  console.log('   Password: Manager@123');
  console.log('\n📱 Staff Login (Mobile App):');
  console.log(`   Waiter 1: ${waiter1.phone} / PIN: 1234`);
  console.log(`   Waiter 2: ${waiter2.phone} / PIN: 1234`);
  console.log(`   Cook: ${cook1.phone} / PIN: 5678`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
