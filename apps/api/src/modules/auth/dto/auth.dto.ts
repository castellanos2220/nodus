import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'advisory@nodus.local' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'Nodus2026*' })
  @IsString()
  @MinLength(1, { message: 'La contraseña es obligatoria' })
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token emitido en el login' })
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'La nueva contraseña debe tener al menos 10 caracteres' })
  @MaxLength(128)
  newPassword!: string;
}
