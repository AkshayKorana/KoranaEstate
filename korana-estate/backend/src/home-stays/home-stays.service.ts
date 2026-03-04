import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateHomeStayDto } from './dto/create-home-stay.dto'

@Injectable()
export class HomeStaysService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.homeStay.findMany({
      include: { owner: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  create(ownerId: string, dto: CreateHomeStayDto) {
    return this.prisma.homeStay.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        pricePerNight: dto.pricePerNight,
        imageUrl: dto.imageUrl,
        ownerId,
      },
      include: { owner: { select: { id: true, fullName: true } } },
    })
  }

  async getById(id: string) {
    const homeStay = await this.prisma.homeStay.findUnique({
      where: { id },
      include: { owner: { select: { id: true, fullName: true } } },
    })
    if (!homeStay) {
      throw new NotFoundException('Home stay not found')
    }
    return homeStay
  }

  async deleteById(id: string, ownerId: string) {
    const homeStay = await this.prisma.homeStay.findUnique({ where: { id } })
    if (!homeStay) {
      throw new NotFoundException('Home stay not found')
    }
    if (homeStay.ownerId !== ownerId) {
      throw new ForbiddenException('Only the owner can delete this listing')
    }

    return this.prisma.homeStay.delete({ where: { id } })
  }
}
