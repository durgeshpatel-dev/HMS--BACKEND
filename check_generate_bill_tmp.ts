import { billService } from './src/services/bill.service';
import prisma from './src/config/database';

async function main() {
  const orderId = 131;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true } });
  if (!order) {
    console.error('Order not found');
    return;
  }
  const restaurantId = order.restaurantId;
  try {
    const bill = await billService.generateBill(orderId, restaurantId, {
      discountPercentage: 0,
      discountAmount: 0,
      extraCharges: 0,
    });
    console.log('SUCCESS', bill.id, bill.billNumber);
  } catch (error: any) {
    console.error('ERROR MESSAGE:', error?.message);
    console.error(error);
  }

  await prisma.$disconnect();
}

main().then(() => process.exit(0));
