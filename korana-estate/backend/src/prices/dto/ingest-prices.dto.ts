import { Type } from 'class-transformer'
import { IsArray, IsISO8601, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

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
