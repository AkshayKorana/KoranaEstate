export const LISTING_TYPES = ['Product', 'Service'] as const
export const UNITS = ['per_kg', 'per_bag', 'per_item', 'per_hour', 'per_day', 'fixed'] as const

export const ESTATE_BLOCKS = [
  {
    slug: 'fertilizers',
    title: 'Fertilizers',
    titleKn: 'ರಸಗೊಬ್ಬರಗಳು',
    subtitle: 'NPK, organic manure, micronutrients',
    subtitleKn: 'ಎನ್‌ಪಿಕೆ, ಸೈವಿಕ ಗೊಬ್ಬರ, ಸೂಕ್ಷ್ಮ ಪೋಷಕಾಂಶಗಳು',
    categories: ['Fertilizer', 'Manure', 'Pesticide'],
    createCategory: 'Fertilizer',
    createType: 'Product',
    image: '/estate/fertilizers.svg',
  },
  {
    slug: 'workers',
    title: 'Workers',
    titleKn: 'ಕಾರ್ಮಿಕರು',
    subtitle: 'Pickers, pruning staff, estate labor',
    subtitleKn: 'ಕಾಯಿ ಕೀಳುವವರು, ಕೊಯ್ಲು/ಕತ್ತರಿಸುವ ಸಿಬ್ಬಂದಿ, ತೋಟದ ಕಾರ್ಮಿಕರು',
    categories: ['Labor', 'Worker', 'Workers'],
    createCategory: 'Labor',
    createType: 'Service',
    image: '/estate/workers.svg',
  },
  {
    slug: 'vehicles',
    title: 'Pick-Up and other Vehicle services',
    titleKn: 'ಪಿಕ್-ಅಪ್ ಮತ್ತು ಇತರೆ ವಾಹನ ಸೇವೆಗಳು',
    subtitle: 'Pickup rental, transport, tractors',
    subtitleKn: 'ಪಿಕ್‌ಅಪ್ ಬಾಡಿಗೆ, ಸಾಗಣೆ, ಟ್ರಾಕ್ಟರ್‌ಗಳು',
    categories: ['Machinery', 'Vehicle Service', 'Pick-Up and other Vehicle services'],
    createCategory: 'Pick-Up and other Vehicle services',
    createType: 'Service',
    image: '/estate/vehicles.svg',
  },
  {
    slug: 'equipments',
    title: 'Estate Equipments',
    titleKn: 'ಎಸ್ಟೇಟ್ ಉಪಕರಣಗಳು',
    subtitle: 'Sprayers, tools, pumps, farm gear',
    subtitleKn: 'ಸ್ಪ್ರೇಯರ್‌ಗಳು, ಸಾಧನಗಳು, ಪಂಪ್‌ಗಳು, ಕೃಷಿ ಉಪಕರಣಗಳು',
    categories: ['Tools', 'Irrigation', 'Estate Equipment', 'Estate Equipments'],
    createCategory: 'Estate Equipments',
    createType: 'Product',
    image: '/estate/equipments.svg',
  },
] as const

export type EstateBlock = (typeof ESTATE_BLOCKS)[number]

export function getEstateBlockBySlug(slug: string): EstateBlock | null {
  return ESTATE_BLOCKS.find((b) => b.slug === slug) ?? null
}

export function blockHasCategory(block: EstateBlock, category: string): boolean {
  return (block.categories as readonly string[]).includes(category)
}
