import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VendaDia, VendaMes, VendaAno } from './dashboard.interfaces';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    this.logger.log('[Dashboard] Buscando resumo geral');

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);

    const [totalDia, totalSemana, totalMes, totalAno, totalGeral] = await Promise.all([
      this.somarVendas(inicioDia, hoje),
      this.somarVendas(inicioSemana, hoje),
      this.somarVendas(inicioMes, hoje),
      this.somarVendas(inicioAno, hoje),
      this.somarVendas(new Date(0), hoje),
    ]);

    const [pedidosHoje, pedidosPendentes, pedidosEmAndamento] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: inicioDia } } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'OUT_FOR_DELIVERY'] } } }),
    ]);

    this.logger.log(`[Dashboard] ✅ Resumo | dia=R$${totalDia} | mes=R$${totalMes} | ano=R$${totalAno}`);

    return {
      vendas: { dia: totalDia, semana: totalSemana, mes: totalMes, ano: totalAno, geral: totalGeral },
      pedidos: { hoje: pedidosHoje, pendentes: pedidosPendentes, emAndamento: pedidosEmAndamento },
    };
  }

  async getVendasPorDia(dias = 7): Promise<VendaDia[]> {
    this.logger.log(`[Dashboard] Buscando vendas por dia | ultimos=${dias} dias`);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    inicio.setHours(0, 0, 0, 0);

    const vendas = await this.prisma.sale.findMany({
      where: { date: { gte: inicio } },
      orderBy: { date: 'asc' },
    });

    const agrupado: Record<string, number> = {};
    vendas.forEach((v) => {
      const dia = v.date.toISOString().split('T')[0];
      agrupado[dia] = (agrupado[dia] ?? 0) + Number(v.amount);
    });

    const resultado: VendaDia[] = [];
    for (let i = dias; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      resultado.push({ data: key, total: agrupado[key] ?? 0 });
    }

    return resultado;
  }

  async getVendasPorMes(meses = 12): Promise<VendaMes[]> {
    this.logger.log(`[Dashboard] Buscando vendas por mes | ultimos=${meses} meses`);
    const inicio = new Date();
    inicio.setMonth(inicio.getMonth() - meses);
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);

    const vendas = await this.prisma.sale.findMany({
      where: { date: { gte: inicio } },
      orderBy: { date: 'asc' },
    });

    const agrupado: Record<string, number> = {};
    vendas.forEach((v) => {
      const key = `${v.date.getFullYear()}-${String(v.date.getMonth() + 1).padStart(2, '0')}`;
      agrupado[key] = (agrupado[key] ?? 0) + Number(v.amount);
    });

    const resultado: VendaMes[] = [];
    for (let i = meses; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!resultado.find((r) => r.mes === key)) {
        resultado.push({ mes: key, total: agrupado[key] ?? 0 });
      }
    }

    return resultado;
  }

  async getVendasPorAno(): Promise<VendaAno[]> {
    this.logger.log('[Dashboard] Buscando vendas por ano');
    const vendas = await this.prisma.sale.findMany({ orderBy: { date: 'asc' } });

    const agrupado: Record<string, number> = {};
    vendas.forEach((v) => {
      const key = String(v.date.getFullYear());
      agrupado[key] = (agrupado[key] ?? 0) + Number(v.amount);
    });

    const resultado: VendaAno[] = Object.entries(agrupado).map(([ano, total]) => ({ ano, total }));
    return resultado;
  }

  async getProdutosMaisVendidos(limit = 5) {
    this.logger.log(`[Dashboard] Buscando produtos mais vendidos | limit=${limit}`);
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const result = await Promise.all(
      items.map(async (item) => {
        const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
        return { produto: product?.name ?? 'Desconhecido', quantidade: item._sum.quantity ?? 0 };
      }),
    );

    return result;
  }

  private async somarVendas(inicio: Date, fim: Date): Promise<number> {
    const result = await this.prisma.sale.aggregate({
      _sum: { amount: true },
      where: { date: { gte: inicio, lte: fim } },
    });
    return Number(result._sum.amount ?? 0);
  }
}