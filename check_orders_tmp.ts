import prisma from './src/config/database';

async function main() {
  const ids = [131, 132];
  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: {
      items: true,
      bill: true,
      table: true,
    },
  });

  for (const o of orders) {
    console.log(
      'Order',
      o.id,
      'status',
      o.status,
      'type',
      o.orderType,
      'items',
      o.items.length,
      'tableId',
      o.tableId,
      'hasBill',
      Boolean(o.bill),
      'subtotal',
      o.subtotal.toString(),
      'tax',
      o.taxAmount.toString(),
      'discount',
      o.discountAmount.toString(),
      'total',
      o.totalAmount.toString(),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
