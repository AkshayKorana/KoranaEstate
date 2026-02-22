import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentWebhookDto } from './dto/webhook.dto'
import { PaymentsService } from './payments.service'

@Controller({ path: 'payments', version: '1' })
@ApiTags('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create provider payment intent for an order' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiOkResponse({ description: 'Payment intent created' })
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPaymentIntent(dto, req.user.userId)
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider webhook' })
  @ApiBody({ type: PaymentWebhookDto })
  webhook(
    @Body() dto: PaymentWebhookDto,
    @Headers('x-korana-signature') signature?: string,
  ) {
    this.paymentsService.verifyWebhookSignature(JSON.stringify(dto), signature)
    return this.paymentsService.processWebhook(dto)
  }
}
