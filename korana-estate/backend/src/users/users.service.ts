import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        location: true,
        sellerVerified: true,
        verified: true,
        verificationLevel: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto })
  }

  updateRole(userId: string, dto: UpdateRoleDto) {
    return this.prisma.user.update({ where: { id: userId }, data: { role: dto.role } })
  }

  verifySeller(userId: string, verified: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { sellerVerified: verified } })
  }

  async reputation(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        verified: true,
        verificationLevel: true,
        sellerRating: {
          select: {
            averageRating: true,
            totalReviews: true,
            weightedScore: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!user) throw new NotFoundException('User not found')
    return user
  }
}
