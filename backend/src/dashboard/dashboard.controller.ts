import { Controller, Get, Query, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { VendaDia, VendaMes, VendaAno } from './dashboard.interfaces';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    this.logger.log('[Dashboard] GET /dashboard/summary');
    return this.dashboardService.getSummary();
  }

  @Get('vendas/dia')
  getVendasPorDia(@Query('dias') dias?: string): Promise<VendaDia[]> {
    this.logger.log(`[Dashboard] GET /dashboard/vendas/dia | dias=${dias ?? 7}`);
    return this.dashboardService.getVendasPorDia(dias ? parseInt(dias) : 7);
  }

  @Get('vendas/mes')
  getVendasPorMes(@Query('meses') meses?: string): Promise<VendaMes[]> {
    this.logger.log(`[Dashboard] GET /dashboard/vendas/mes | meses=${meses ?? 12}`);
    return this.dashboardService.getVendasPorMes(meses ? parseInt(meses) : 12);
  }

  @Get('vendas/ano')
  getVendasPorAno(): Promise<VendaAno[]> {
    this.logger.log('[Dashboard] GET /dashboard/vendas/ano');
    return this.dashboardService.getVendasPorAno();
  }

  @Get('produtos/mais-vendidos')
  getProdutosMaisVendidos(@Query('limit') limit?: string) {
    this.logger.log(`[Dashboard] GET /dashboard/produtos/mais-vendidos | limit=${limit ?? 5}`);
    return this.dashboardService.getProdutosMaisVendidos(limit ? parseInt(limit) : 5);
  }
}