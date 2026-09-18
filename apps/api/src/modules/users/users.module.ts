import { Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, RoleCode, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLE_PERMISSIONS } from '@nodus/types';
import { RequirePermissions } from '../../core/auth/decorators';
import { PaginationDto, paginate } from '../../core/common/dto/pagination.dto';
import { NotFoundError } from '../../core/common/errors/domain.errors';
import { PrismaService } from '../../core/prisma/prisma.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UserListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @Transform(trim) @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional() @IsEnum(RoleCode)
  role?: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserListQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = { code: query.role };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        // Nunca se selecciona `passwordHash`: no existe motivo para que salga de
        // `AuthService`, y un `select` explícito lo hace imposible por descuido.
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { code: true, name: true } },
          company: { select: { id: true, code: true, name: true } },
          consultant: { select: { id: true, code: true, status: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(rows, total, query);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: {
            code: true,
            name: true,
            permissions: { select: { permission: { select: { code: true, module: true } } } },
          },
        },
        company: { select: { id: true, code: true, name: true } },
        consultant: { select: { id: true, code: true, status: true } },
      },
    });

    if (!user) throw new NotFoundError('el usuario', id);

    return {
      ...user,
      role: {
        code: user.role.code,
        name: user.role.name,
        permissions: user.role.permissions.map((item) => item.permission),
      },
    };
  }

  /** Matriz rol → permisos vigente en base de datos. */
  async roles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { code: true, module: true } } } },
        _count: { select: { users: true } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      userCount: role._count.users,
      permissions: role.permissions.map((item) => item.permission.code).sort(),
      // Se expone también la matriz declarada en `@nodus/types` para poder
      // detectar de un vistazo si la base y el código divergieron.
      declaredPermissions: [...(ROLE_PERMISSIONS[role.code] ?? [])].sort(),
    }));
  }
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions('USER_MANAGE')
  @ApiOperation({ summary: 'Listado de usuarios' })
  findAll(@Query() query: UserListQueryDto) {
    return this.users.findAll(query);
  }

  @Get('users/:id')
  @RequirePermissions('USER_MANAGE')
  @ApiOperation({ summary: 'Detalle de un usuario con sus permisos efectivos' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findById(id);
  }

  @Get('roles')
  @RequirePermissions('USER_MANAGE')
  @ApiOperation({
    summary: 'Roles y permisos',
    description:
      'Compara los permisos persistidos con los declarados en `@nodus/types`, de modo que ' +
      'una divergencia entre código y base sea visible.',
  })
  roles() {
    return this.users.roles();
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
