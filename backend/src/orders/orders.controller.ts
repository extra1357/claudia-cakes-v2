import { Controller, Get, Post, Put, Body, Param, Query, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() body: {
    customerPhone: string;
    customerName: string;
    paymentMethod: 'PIX_ANTECIPADO' | 'NA_ENTREGA';
    items: { productId: string; quantity: number }[];
  }) {
    this.logger.log(`[Orders] POST /orders | cliente=${body.customerName}`);
    return this.ordersService.create(body);
  }

  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    this.logger.log(`[Orders] GET /orders | status=${status ?? 'todos'}`);
    return this.ordersService.findAll(status);
  }

  @Get('phone/:phone')
  findByPhone(@Param('phone') phone: string) {
    this.logger.log(`[Orders] GET /orders/phone/${phone}`);
    return this.ordersService.findByPhone(phone);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`[Orders] GET /orders/${id}`);
    return this.ordersService.findOne(id);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; note?: string; estimatedDelivery?: string },
  ) {
    this.logger.log(`[Orders] PUT /orders/${id}/status | status=${body.status}`);
    return this.ordersService.updateStatus(
      id,
      body.status,
      body.note,
      body.estimatedDelivery ? new Date(body.estimatedDelivery) : undefined,
    );
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: { cancelledBy: 'CUSTOMER' | 'ADMIN' }) {
    this.logger.log(`[Orders] PUT /orders/${id}/cancel | por=${body.cancelledBy}`);
    return this.ordersService.cancel(id, body.cancelledBy);
  }
}