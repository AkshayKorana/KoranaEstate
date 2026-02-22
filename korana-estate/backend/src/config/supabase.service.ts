import { Injectable } from '@nestjs/common'

@Injectable()
export class SupabaseService {
  readonly url = process.env.SUPABASE_URL ?? ''
  readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  readonly storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'korana-estate-assets'

  /**
   * Keep service-role usage backend-only for storage and privileged realtime operations.
   * Frontends must never receive service role keys.
   */
}
