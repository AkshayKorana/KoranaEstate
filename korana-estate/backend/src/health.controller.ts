import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

@Controller({ path: 'health', version: '1' })
@ApiTags('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  @ApiOkResponse({ description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'Korana Estate Backend',
      timestamp: new Date().toISOString(),
    }
  }
}
