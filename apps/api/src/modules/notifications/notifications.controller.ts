import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { CurrentUser, RequirePermissions } from '../../core/auth/decorators';
import { PaginationDto } from '../../core/common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'Mis notificaciones' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.findForUser(user, query, unreadOnly === 'true');
  }

  @Get('unread-count')
  @RequirePermissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'Número de notificaciones sin leer' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user);
  }

  @Patch(':id/read')
  @RequirePermissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  @RequirePermissions('NOTIFICATION_READ')
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }

  @Get('templates')
  @RequirePermissions('LOOKUP_MANAGE')
  @ApiOperation({
    summary: 'Plantillas de comunicación TCOM1–TCOM12',
    description: 'Parametrizables: asunto, cuerpo, audiencias y canal viven en base de datos.',
  })
  templates() {
    return this.notifications.listTemplates();
  }
}
