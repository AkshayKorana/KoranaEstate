import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'

enum ResolutionStatus {
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export class ResolveDisputeDto {
  @ApiPropertyOptional({ enum: ResolutionStatus, default: ResolutionStatus.RESOLVED })
  @IsOptional()
  @IsEnum(ResolutionStatus)
  status?: ResolutionStatus
}
