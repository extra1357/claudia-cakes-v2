import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import axios from 'axios';

const sessions: Record<string, any> = {};

function getSession(phone: string) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 'INICIO', cart: [], customerName: '' };
  }
  return sessions[phone];
}

function clearSession(phone: string) {
  sessions[phone] = { step: 'INICIO', cart: [], customerName: '' };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
  ) {}

  async sendMessage(phone: string, text: string) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || token === 'seu-token-aqui') {
      this.logger.warn(`[Whatsapp] Token nao configurado — simulando envio para ${phone}: "${text}"`);
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(`[Whatsapp] ✅ Mensagem enviada para ${phone}`);
    } catch (error) {
      this.logger.error(`[Whatsapp] ❌ Erro ao enviar mensagem: ${error.message}`);
    }
  }

  async processMessage(phone: string, text: string, contactName: string) {
    const session = getSession(phone);
    const lower = text.toLowerCase().trim();
    this.logger.log(`[Whatsapp] Processando | phone=${phone} | step=${session.step} | texto="${text}"`);

    if (['cancelar', 'cancel', 'sair', 'exit'].includes(lower)) {
      clearSession(phone);
      return this.sendMessage(phone, 'Tudo bem! Se precisar de algo, e so chamar. 😊');
    }

    switch (session.step) {
      case 'INICIO': return this.handleInicio(phone, session, contactName);
      case 'AGUARDANDO_NOME': return this.handleNome(phone, session, text);
      case 'CARDAPIO': return this.handleCardapio(phone, session, text);
      case 'AGUARDANDO_QUANTIDADE': return this.handleQuantidade(phone, session, text);
      case 'MAIS_ITENS': return this.handleMaisItens(phone, session, text);
      case 'AGUARDANDO_CONFIRMACAO': return this.handleConfirmacao(phone, session, text);
      case 'AGUARDANDO_PAGAMENTO': return this.handlePagamento(phone, session, text);
      default:
        clearSession(phone);
        return this.handleInicio(phone, session, contactName);
    }
  }

  private async handleInicio(phone: string, session: any, contactName: string) {
    if (contactName) {
      session.customerName = contactName;
      session.step = 'CARDAPIO';
      return this.enviarCardapio(phone, session);
    }
    session.step = 'AGUARDANDO_NOME';
    return this.sendMessage(phone, 'Ola! 🎂 Bem-vindo a *Claudia Cakes*!\n\nPrimeiro, qual e o seu nome?');
  }

  private async handleNome(phone: string, session: any, text: string) {
    session.customerName = text.trim().split(' ')[0];
    session.step = 'CARDAPIO';
    return this.enviarCardapio(phone, session);
  }

  private async enviarCardapio(phone: string, session: any) {
    const products = await this.productsService.findAll();
    if (products.length === 0) {
      return this.sendMessage(phone, 'No momento nao temos produtos disponiveis. Tente mais tarde. 🙏');
    }
    session.products = products;
    let msg = `Ola, *${session.customerName}*! 🎂\n\nAqui esta nosso cardapio:\n\n`;
    products.forEach((p, i) => {
      const preco = Number(p.price).toFixed(2).replace('.', ',');
      const estoque = p.stock <= p.lowStockThreshold ? ' ⚠️ *Poucas unidades!*' : '';
      msg += `*${i + 1}.* ${p.name} — R$ ${preco}${estoque}\n`;
      if (p.description) msg += `   _${p.description}_\n`;
      msg += '\n';
    });
    msg += 'Digite o *numero* do produto desejado ou *0* para finalizar.';
    session.step = 'CARDAPIO';
    return this.sendMessage(phone, msg);
  }

  private async handleCardapio(phone: string, session: any, text: string) {
    const num = parseInt(text);
    if (isNaN(num) || num < 0 || num > session.products.length) {
      return this.sendMessage(phone, 'Por favor, digite o *numero* de um produto do cardapio.');
    }
    if (num === 0) {
      if (session.cart.length === 0) {
        return this.sendMessage(phone, 'Voce nao selecionou nenhum item. Digite o numero de um produto.');
      }
      return this.mostrarResumo(phone, session);
    }
    session.selectedProduct = session.products[num - 1];
    session.step = 'AGUARDANDO_QUANTIDADE';
    const preco = Number(session.selectedProduct.price).toFixed(2).replace('.', ',');
    return this.sendMessage(phone, `Voce escolheu *${session.selectedProduct.name}* (R$ ${preco}).\n\nQuantos voce quer? (disponivel: ${session.selectedProduct.stock})`);
  }

  private async handleQuantidade(phone: string, session: any, text: string) {
    const qty = parseInt(text);
    if (isNaN(qty) || qty <= 0) {
      return this.sendMessage(phone, 'Por favor, digite uma quantidade valida.');
    }
    if (qty > session.selectedProduct.stock) {
      return this.sendMessage(phone, `Desculpe, so temos *${session.selectedProduct.stock}* unidades disponiveis.`);
    }
    const existing = session.cart.find((i: any) => i.productId === session.selectedProduct.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      session.cart.push({ productId: session.selectedProduct.id, name: session.selectedProduct.name, price: Number(session.selectedProduct.price), quantity: qty });
    }
    session.step = 'MAIS_ITENS';
    return this.sendMessage(phone, `✅ *${qty}x ${session.selectedProduct.name}* adicionado!\n\nDeseja adicionar mais algum item?\n*1* - Sim, ver cardapio\n*2* - Nao, ver resumo`);
  }

  private async handleMaisItens(phone: string, session: any, text: string) {
    if (text === '1') return this.enviarCardapio(phone, session);
    if (text === '2') return this.mostrarResumo(phone, session);
    return this.sendMessage(phone, 'Digite *1* para adicionar mais itens ou *2* para ver o resumo.');
  }

  private async mostrarResumo(phone: string, session: any) {
    let msg = '🛒 *Resumo do seu pedido:*\n\n';
    let total = 0;
    session.cart.forEach((item: any) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      msg += `• ${item.quantity}x ${item.name} — R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    });
    msg += `\n*Total: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
    msg += 'O pedido esta correto?\n*1* - Sim, confirmar\n*2* - Nao, cancelar';
    session.step = 'AGUARDANDO_CONFIRMACAO';
    return this.sendMessage(phone, msg);
  }

  private async handleConfirmacao(phone: string, session: any, text: string) {
    if (text === '2') {
      clearSession(phone);
      return this.sendMessage(phone, 'Pedido cancelado. Se quiser fazer um novo pedido, e so chamar! 😊');
    }
    if (text !== '1') {
      return this.sendMessage(phone, 'Digite *1* para confirmar ou *2* para cancelar.');
    }
    session.step = 'AGUARDANDO_PAGAMENTO';
    return this.sendMessage(phone, '💳 *Forma de pagamento:*\n\n*1* - PIX antecipado\n*2* - Pagamento na entrega');
  }

  private async handlePagamento(phone: string, session: any, text: string) {
    if (!['1', '2'].includes(text)) {
      return this.sendMessage(phone, 'Digite *1* para PIX antecipado ou *2* para pagamento na entrega.');
    }
    const paymentMethod = text === '1' ? 'PIX_ANTECIPADO' : 'NA_ENTREGA';
    try {
      const order = await this.ordersService.create({
        customerPhone: phone,
        customerName: session.customerName,
        paymentMethod,
        items: session.cart.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      });
      const pagamento = paymentMethod === 'PIX_ANTECIPADO' ? 'PIX antecipado' : 'Pagamento na entrega';
      let msg = `✅ *Pedido enviado para a Claudia Cakes!* 🎂\n\n`;
      msg += `📋 *Pedido #${order.id.slice(-6).toUpperCase()}*\n`;
      msg += `💳 Pagamento: ${pagamento}\n\n`;
      msg += `Em breve voce recebera a confirmacao e a previsao de entrega.\n\n`;
      if (paymentMethod === 'PIX_ANTECIPADO') msg += `🔑 *Chave PIX:* claudia@claudiacakes.com.br\n\n`;
      msg += `Para acompanhar ou cancelar, entre em contato conosco. 😊`;
      this.logger.log(`[Whatsapp] ✅ Pedido criado | orderId=${order.id} | phone=${phone}`);
      clearSession(phone);
      return this.sendMessage(phone, msg);
    } catch (error) {
      this.logger.error(`[Whatsapp] ❌ Erro ao criar pedido: ${error.message}`);
      return this.sendMessage(phone, 'Desculpe, ocorreu um erro. Tente novamente ou entre em contato conosco.');
    }
  }
}