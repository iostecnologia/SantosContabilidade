import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  listPermissionCatalog() {
    return this.tx.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
  }

  list(organizationId: string) {
    return this.tx.role.findMany({
      where: { organizationId },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateRoleDto) {
    const role = await this.tx.role.create({ data: { organizationId, name: dto.name } });
    if (dto.permissionKeys?.length) {
      await this.setPermissions(organizationId, role.id, dto.permissionKeys);
    }
    return this.findOneOrThrow(organizationId, role.id);
  }

  async update(organizationId: string, id: string, dto: UpdateRoleDto) {
    await this.findOneOrThrow(organizationId, id);
    await this.tx.role.update({ where: { id }, data: { name: dto.name } });
    return this.findOneOrThrow(organizationId, id);
  }

  async setPermissions(organizationId: string, roleId: string, permissionKeys: string[]) {
    const role = await this.findOneOrThrow(organizationId, roleId);
    if (role.isSystem) {
      throw new ForbiddenException("Papel de sistema não pode ter permissões alteradas.");
    }

    const permissions = await this.tx.permission.findMany({ where: { key: { in: permissionKeys } } });
    if (permissions.length !== new Set(permissionKeys).size) {
      throw new BadRequestException("Uma ou mais chaves de permissão são inválidas.");
    }

    await this.tx.rolePermission.deleteMany({ where: { organizationId, roleId } });
    if (permissions.length > 0) {
      await this.tx.rolePermission.createMany({
        data: permissions.map((p) => ({ organizationId, roleId, permissionId: p.id })),
      });
    }

    // Usuários deste papel têm as permissões antigas "assadas" no JWT — força
    // reautenticação (login ou refresh) para que a mudança valha de fato.
    await this.bumpSecurityStampForRoleUsers(organizationId, roleId);

    return this.findOneOrThrow(organizationId, roleId);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const role = await this.findOneOrThrow(organizationId, id);
    if (role.isSystem) {
      throw new ForbiddenException("Papel de sistema não pode ser removido.");
    }
    await this.bumpSecurityStampForRoleUsers(organizationId, id);
    await this.tx.role.delete({ where: { id } });
  }

  private async bumpSecurityStampForRoleUsers(organizationId: string, roleId: string): Promise<void> {
    const userRoles = await this.tx.userRole.findMany({
      where: { organizationId, roleId },
      select: { userId: true },
    });
    for (const ur of userRoles) {
      await this.tx.user.update({ where: { id: ur.userId }, data: { securityStamp: { increment: 1 } } });
    }
  }

  private async findOneOrThrow(organizationId: string, id: string) {
    const role = await this.tx.role.findFirst({
      where: { id, organizationId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException("Papel não encontrado.");
    }
    return role;
  }
}
