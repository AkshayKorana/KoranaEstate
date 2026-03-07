import { Type } from 'class-transformer'
import { IsArray, IsISO8601, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

export class IngestSeriesPointDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsString()
  day?: string

  @IsOptional()
  @IsNumber()
  value?: number | null
}

export class IngestSourceDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsString()
  url!: string

  @IsOptional()
  @IsString()
  host?: string
}

export class IngestResultDto {
  @IsString()
  productKey!: string

  @IsNumber()
  value!: number

  @IsString()
  unit!: string

  @IsString()
  source!: string

  @IsString()
  sourceUrl!: string

  @IsNumber()
  confidence!: number

  @IsString()
  rawText!: string

  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsNumber()
  currentPrice?: number

  @IsOptional()
  @IsNumber()
  lastWeekPrice?: number

  @IsOptional()
  @IsNumber()
  lastWeekPriceMin?: number

  @IsOptional()
  @IsNumber()
  lastWeekPriceMax?: number

  @IsOptional()
  @IsNumber()
  todayPrice?: number

  @IsOptional()
  @IsNumber()
  todayPriceMin?: number

  @IsOptional()
  @IsNumber()
  todayPriceMax?: number

  @IsOptional()
  @IsNumber()
  expectedNextPrice?: number

  @IsOptional()
  @IsNumber()
  expectedNextPriceMin?: number

  @IsOptional()
  @IsNumber()
  expectedNextPriceMax?: number

  @IsOptional()
  @IsString()
  shortDescription?: string

  @IsOptional()
  @IsString()
  trend?: string

  @IsOptional()
  @IsString()
  analysisSummary?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  analysisBullets?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestSeriesPointDto)
  historicalPoints?: IngestSeriesPointDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestSeriesPointDto)
  forecastPoints?: IngestSeriesPointDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestSourceDto)
  sources?: IngestSourceDto[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class IngestErrorDto {
  @IsString()
  productKey!: string

  @IsString()
  error!: string

  @IsString()
  sourceUrl!: string
}

export class IngestPricesDto {
  @IsISO8601()
  runAt!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestResultDto)
  results!: IngestResultDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestErrorDto)
  @IsOptional()
  errors: IngestErrorDto[] = []
}
