import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Logger,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    this.logger.log('[Products] GET /products');
    return this.productsService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    this.logger.log(`[Products] GET /products/${id}`);
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() body: {
    name: string;
    description?: string;
    price: number;
    stock: number;
    lowStockThreshold?: number;
    photoUrl?: string;
    photoMode?: string;
  }) {
    this.logger.log(`[Products] POST /products | name=${body.name}`);
    return this.productsService.create(body);
  }

  @Post('upload/:id')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
  }))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    this.logger.log(`[Products] Upload foto produto id=${id} | arquivo=${file.filename}`);
    const photoUrl = `/uploads/${file.filename}`;
    return this.productsService.update(id, { photoUrl, photoMode: 'upload' });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    this.logger.log(`[Products] PUT /products/${id}`);
    return this.productsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.logger.log(`[Products] DELETE /products/${id}`);
    return this.productsService.remove(id);
  }
}