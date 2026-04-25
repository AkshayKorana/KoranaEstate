import { Type } from 'class-transformer'
import { IsArray, IsISO8601, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

export class IngestObservationItemDto {
  @IsString()
  productKey!: string

  @IsNumber()
  price!: number

  @IsString()
  unit!: string

  @IsString()
  source!: string

  @IsString()
  sourceUrl!: string

  @IsISO8601()
  observedAt!: string

  @IsOptional()
  @IsISO8601()
  capturedAt?: string

  @IsOptional()
  @IsString()
  rawText?: string

  @IsOptional()
  @IsNumber()
  confidence?: number
}

export class IngestObservationErrorDto {
  @IsString()
  productKey!: string

  @IsString()
  error!: string

  @IsString()
  sourceUrl!: string
}

export class IngestObservationsDto {
  @IsISO8601()
  runAt!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestObservationItemDto)
  observations!: IngestObservationItemDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestObservationErrorDto)
  @IsOptional()
  errors: IngestObservationErrorDto[] = []
}
