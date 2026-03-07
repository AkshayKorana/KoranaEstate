import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.ACCESS_JWT_SECRET ?? process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error(
        'Missing JWT secret. Set ACCESS_JWT_SECRET (preferred) or JWT_SECRET in apps/backend/.env',
      )
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  validate(payload: { sub: string; email: string; role: string }) {
    return { userId: payload.sub, email: payload.email, role: payload.role }
  }
}
