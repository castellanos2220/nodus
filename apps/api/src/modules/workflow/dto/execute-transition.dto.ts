import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ExecuteTransitionDto {
  @ApiProperty({
    description: 'Código de la transición a ejecutar',
    example: 'CLASSIFY',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  transition!: string;

  @ApiPropertyOptional({
    description: 'Observación que queda registrada en el historial y la bitácora',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Datos propios de la transición. Su forma depende del código; véase docs/workflow/transitions.md',
    example: { applicationId: '…', decisionRationale: '…' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
