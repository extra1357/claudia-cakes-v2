import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { OrderStatus } from '@prisma/client';

interface OrderItemData {
  productId: string;
  quantity: number;
  unitPrice: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async create(data: {
    customerPhone: string;
    customerName: string;
    paymentMethod: 'PIX_ANTECIPADO' | 'NA_ENTREGA';
    items: { productId: string; quantity: number }[];
  }) {
    this.logger.log(`[Orders] Criando pedido | cliente=${data.customerName} | phone=${data.customerPhone}`);

    let totalAmount = 0;
    const itemsData: OrderItemData[] = [];

    for (const item of data.items) {
      const product = await this.productsService.findOne(item.productId);
      if (!product.active) throw new BadRequestException(`Produto ${product.name} indisponivel`);
      if (product.stock < item.quantity) throw new BadRequestException(`Estoque insuficiente para ${product.name}`);
      const unitPrice = Number(product.price);
      totalAmount += unitPrice * item.quantity;
      itemsData.push({ productId: item.productId, quantity: item.quantity, unitPrice });
    }

    const order = await this.prisma.order.create({
      data: {
        customerPhone: data.customerPhone,
        customerName: data.customerName,
        paymentMethod: data.paymentMethod,
        totalAmount,
        items: { create: itemsData },
        statusHistory: { create: { status: 'PENDING', note: 'Pedido recebido' } },
      },
      include: { items: { include: { product: true } }, statusHistory: true },
    });

    for (const item of data.items) {
      await this.productsService.decrementStock(item.productId, item.quantity);
    }

    this.logger.log(`[Orders] ✅ Pedido criado id=${order.id} | total=R$${totalAmount}`);
    return order;
  }

  async findAll(status?: OrderStatus) {
    this.logger.log(`[Orders] Buscando pedidos | status=${status ?? 'todos'}`);
    return this.prisma.order.findMany({
      where: status ? { status } : {},
      include: { items: { include: { product: true } }, statusHistory: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    this.logger.log(`[Orders] Buscando pedido id=${id}`);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException(`Pedido ${id} nao encontrado`);
    return order;
  }

  async findByPhone(phone: string) {
    this.logger.log(`[Orders] Buscando pedidos do cliente phone=${phone}`);
    return this.prisma.order.findMany({
      where: { customerPhone: phone },
      include: { items: { include: { product: true } }, statusHistory: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: OrderStatus, note?: string, estimatedDelivery?: Date) {
    this.logger.log(`[Orders] Atualizando status id=${id} | status=${status}`);
    await this.findOne(id);

    const data: any = { status };
    if (estimatedDelivery) data.estimatedDelivery = estimatedDelivery;

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        ...data,
        statusHistory: { create: { status, note: note ?? '' } },
      },
      include: { items: { include: { product: true } }, statusHistory: { orderBy: { createdAt: 'desc' } } },
    });

    if (status === 'DELIVERED') {
      await this.prisma.sale.create({ data: { orderId: id, amount: order.totalAmount, date: new Date() } });
      this.logger.log(`[Orders] ✅ Venda registrada para pedido id=${id}`);
    }

    this.logger.log(`[Orders] ✅ Status atualizado id=${id} | novo status=${status}`);
    return order;
  }

  async cancel(id: string, cancelledBy: 'CUSTOMER' | 'ADMIN') {
    this.logger.log(`[Orders] Cancelando pedido id=${id} | por=${cancelledBy}`);
    const order = await this.findOne(id);

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Pedido nao pode ser cancelado no status ${order.status}`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        statusHistory: { create: { status: 'CANCELLED', note: `Cancelado por ${cancelledBy}` } },
      },
      include: { items: { include: { product: true } } },
    });

    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      this.logger.log(`[Orders] Estoque restaurado produto=${item.productId} qty=${item.quantity}`);
    }

    this.logger.log(`[Orders] ✅ Pedido cancelado id=${id}`);
    return updated;
  }
}