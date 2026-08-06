import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaTransactionAdapter } from "../tenancy/tenancy.module";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionAdapter>) {}

  private get tx() {
    return this.txHost.tx;
  }

  list(organizationId: string) {
    return this.tx.user.findMany({
      where: { organizationId },
      select: USER_SELECT,
      orderBy: { fullName: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const passwordHash = await argon2.hash(dto.password);

    let user;
    try {
      user = await this.tx.user.create({
        data: { organizationId, email: dto.email, fullName: dto.fullName, passwordHash },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Já existe um usuário com este e-mail nesta organização.");
      }
      throw err;
    }

    if (dto.roleIds?.length) {
      await this.setRoles(organizationId, user.id, dto.roleIds);
    }

    return this.findOneOrThrow(organizationId, user.id);
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto) {
    await this.findOneOrThrow(organizationId, id);
    await this.tx.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        isActive: dto.isActive,
        // Desativar/reativar precisa derrubar tokens já emitidos.
        ...(dto.isActive !== undefined ? { securityStamp: { increment: 1 } } : {}),
      },
    });
    return this.findOneOrThrow(organizationId, id);
  }

  async setRoles(organizationId: string, userId: string, roleIds: string[]) {
    await this.findOneOrThrow(organizationId, userId);

    const roles = await this.tx.role.findMany({ where: { organizationId, id: { in: roleIds } } });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException("Um ou mais papéis são inválidos para esta organização.");
    }

    await this.tx.userRole.deleteMany({ where: { organizationId, userId } });
    if (roles.length > 0) {
      await this.tx.userRole.createMany({
        data: roles.map((r) => ({ organizationId, userId, roleId: r.id })),
      });
    }

    // Permissões "assadas" no JWT ficam desatualizadas até o próximo login/refresh.
    await this.tx.user.update({ where: { id: userId }, data: { securityStamp: { increment: 1 } } });

    return this.findOneOrThrow(organizationId, userId);
  }

  private async findOneOrThrow(organizationId: string, id: string) {
    const user = await this.tx.user.findFirst({
      where: { id, organizationId },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return user;
  }
}
