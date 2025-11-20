import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private i18n: I18nService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        userType: true,
        isVerified: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        await this.i18n.translate("users.userNotFound")
      );
    }

    return user;
  }
}
