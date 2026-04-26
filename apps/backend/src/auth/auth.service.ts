import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { LogoutDto } from './dto/logout.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { RegisterDto } from './dto/register.dto'

/**
 * Single source of truth for admin emails on the backend.
 * Must stay in sync with apps/web/lib/auth.ts ADMIN_EMAILS.
 */
const ADMIN_EMAILS = new Set(['akshay.koranaest@gmail.com'])

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException('Email already registered')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName,
        passwordHash,
        role: (dto.role as UserRole) ?? UserRole.BUYER,
      },
      select: { id: true, email: true, fullName: true, role: true },
    })

    const refreshToken = await this.issueRefreshToken(user.id, user.email, user.role)
    return {
      user,
      accessToken: this.signAccessToken(user.id, user.email, user.role),
      refreshToken,
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim()
    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user) throw new UnauthorizedException('Invalid credentials')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    const refreshToken = await this.issueRefreshToken(user.id, user.email, user.role)
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: this.signAccessToken(user.id, user.email, user.role),
      refreshToken,
    }
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: {
      sub: string
      email: string
      role: UserRole
      exp: number
    }
    try {
      payload = this.jwtService.verify<{
        sub: string
        email: string
        role: UserRole
        exp: number
      }>(dto.refreshToken, { secret: process.env.REFRESH_JWT_SECRET ?? process.env.JWT_SECRET })
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    let matchedTokenId: string | null = null
    for (const tokenRecord of activeTokens) {
      const isMatch = await bcrypt.compare(dto.refreshToken, tokenRecord.tokenHash)
      if (isMatch) {
        matchedTokenId = tokenRecord.id
        break
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw new UnauthorizedException('User not found')

    // Rotation: revoke current token, issue a new one.
    await this.prisma.refreshToken.update({
      where: { id: matchedTokenId },
      data: { revokedAt: new Date() },
    })

    const refreshToken = await this.issueRefreshToken(user.id, user.email, user.role)
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: this.signAccessToken(user.id, user.email, user.role),
      refreshToken,
    }
  }

  async logout(dto: LogoutDto) {
    let payload: { sub: string } | null = null
    try {
      payload = this.jwtService.verify<{ sub: string }>(dto.refreshToken, {
        secret: process.env.REFRESH_JWT_SECRET ?? process.env.JWT_SECRET,
      })
    } catch {
      return { success: true }
    }

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    for (const tokenRecord of activeTokens) {
      const isMatch = await bcrypt.compare(dto.refreshToken, tokenRecord.tokenHash)
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: tokenRecord.id },
          data: { revokedAt: new Date() },
        })
        break
      }
    }

    return { success: true }
  }

  private resolveRole(email: string, dbRole: UserRole): UserRole {
    return ADMIN_EMAILS.has(email.toLowerCase()) ? UserRole.ADMIN : dbRole
  }

  private signAccessToken(userId: string, email: string, role: UserRole) {
    return this.jwtService.sign(
      { sub: userId, email, role: this.resolveRole(email, role) },
      {
        secret: process.env.ACCESS_JWT_SECRET ?? process.env.JWT_SECRET,
        expiresIn: '15m',
      },
    )
  }

  private async issueRefreshToken(userId: string, email: string, role: UserRole) {
    const refreshToken = this.jwtService.sign(
      { sub: userId, email, role: this.resolveRole(email, role) },
      {
        secret: process.env.REFRESH_JWT_SECRET ?? process.env.JWT_SECRET,
        expiresIn: '30d',
      },
    )

    const tokenHash = await bcrypt.hash(refreshToken, 12)
    const decoded = this.jwtService.decode(refreshToken) as { exp?: number } | null
    const expiresAt = new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    })

    return refreshToken
  }
}
