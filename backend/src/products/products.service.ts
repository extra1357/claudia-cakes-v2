import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    this.logger.log(`[Products] Buscando produtos | includeInactive=${includeInactive}`);
    return this.prisma.product.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    this.logger.log(`[Products] Buscando produto id=${id}`);
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Produto ${id} não encontrado`);
    return product;
  }

  async create(data: {
    name: string;
    description?: string;
    price: number;
    stock: number;
    lowStockThreshold?: number;
    photoUrl?: string;
    photoMode?: string;
  }) {
    this.logger.log(`[Products] Criando produto: ${data.name}`);
    const product = await this.prisma.product.create({ data });
    this.logger.log(`[Products] ✅ Produto criado id=${product.id}`);
    return product;
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
    lowStockThreshold: number;
    photoUrl: string;
    photoMode: string;
    active: boolean;
  }>) {
    this.logger.log(`[Products] Atualizando produto id=${id}`);
    await this.findOne(id);
    const product = await this.prisma.product.update({ where: { id }, data });
    this.logger.log(`[Products] ✅ Produto atualizado id=${id}`);
    return product;
  }

  async remove(id: string) {
    this.logger.log(`[Products] Desativando produto id=${id}`);
    await this.findOne(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
    this.logger.log(`[Products] ✅ Produto desativado id=${id}`);
    return product;
  }

  async decrementStock(id: string, quantity: number) {
    this.logger.log(`[Products] Decrementando estoque id=${id} qty=${quantity}`);
    const product = await this.findOne(id);
    const newStock = product.stock - quantity;
    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });
    if (updated.stock <= updated.lowStockThreshold) {
      this.logger.warn(`[Products] ⚠️ Estoque baixo: ${updated.name} | restam=${updated.stock}`);
    }
    return updated;
  }

  isLowStock(product: { stock: number; lowStockThreshold: number }): boolean {
    return product.stock <= product.lowStockThreshold;
  }
}