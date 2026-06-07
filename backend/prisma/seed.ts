import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("[Seed] Iniciando...");

  await prisma.storeConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "Claudia Cakes",
      welcomeMessage: "Ola! Bem-vindo a Claudia Cakes! Veja nosso cardapio abaixo:",
      orderConfirmMessage: "Seu pedido foi enviado para a Claudia Cakes! Em breve voce recebera a confirmacao.",
      pixKey: "claudia@claudiacakes.com.br",
    },
  });
  console.log("[Seed] StoreConfig criado");

  const hash = await bcrypt.hash("claudia@2024", 10);
  await prisma.admin.upsert({
    where: { email: "claudia@claudiacakes.com.br" },
    update: {},
    create: {
      email: "claudia@claudiacakes.com.br",
      passwordHash: hash,
      name: "Claudia",
    },
  });
  console.log("[Seed] Admin criado: claudia@claudiacakes.com.br / claudia@2024");

  const produtos = [
    { name: "Bolo de Chocolate", description: "Bolo fofinho com ganache", price: 85.00, stock: 10, lowStockThreshold: 2, photoUrl: "https://via.placeholder.com/400x300?text=Bolo+Chocolate", photoMode: "link" },
    { name: "Cupcake Red Velvet", description: "Com cream cheese, unidade", price: 12.50, stock: 20, lowStockThreshold: 5, photoUrl: "https://via.placeholder.com/400x300?text=Cupcake+Red+Velvet", photoMode: "link" },
    { name: "Brownie com Nozes", description: "Caixinha com 6 unidades", price: 38.00, stock: 8, lowStockThreshold: 2, photoUrl: "https://via.placeholder.com/400x300?text=Brownie+Nozes", photoMode: "link" },
    { name: "Torta de Limao", description: "Com merengue, tamanho medio", price: 65.00, stock: 5, lowStockThreshold: 1, photoUrl: "https://via.placeholder.com/400x300?text=Torta+Limao", photoMode: "link" },
  ];

  for (const produto of produtos) {
    await prisma.product.create({ data: produto });
    console.log("[Seed] Produto criado: " + produto.name);
  }

  console.log("[Seed] Seed completo!");
}

main()
  .catch((e) => {
    console.error("[Seed] Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });