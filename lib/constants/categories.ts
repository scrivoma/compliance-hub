// Categories for document filtering - verticals and document types
export interface CategoryItem {
  id: string
  name: string
  displayName: string
  type: 'vertical' | 'documentType'
}

export const VERTICALS: CategoryItem[] = [
  { id: 'sports-online', name: 'sports-online', displayName: 'Sports (Online)', type: 'vertical' },
  { id: 'sports-retail', name: 'sports-retail', displayName: 'Sports (Retail)', type: 'vertical' },
  { id: 'igaming', name: 'igaming', displayName: 'iGaming', type: 'vertical' },
  { id: 'landbased', name: 'landbased', displayName: 'Landbased', type: 'vertical' },
  { id: 'lottery', name: 'lottery', displayName: 'Lottery', type: 'vertical' },
  { id: 'ilottery', name: 'ilottery', displayName: 'iLottery', type: 'vertical' },
  { id: 'fantasy-sports', name: 'fantasy-sports', displayName: 'Fantasy Sports', type: 'vertical' }
]

export const DOCUMENT_TYPES: CategoryItem[] = [
  { id: 'statute', name: 'statute', displayName: 'Statute', type: 'documentType' },
  { id: 'regulation', name: 'regulation', displayName: 'Regulation', type: 'documentType' },
  { id: 'formal-guidance', name: 'formal-guidance', displayName: 'Formal Guidance', type: 'documentType' },
  { id: 'informal-guidance', name: 'informal-guidance', displayName: 'Informal Guidance', type: 'documentType' },
  { id: 'technical-bulletin', name: 'technical-bulletin', displayName: 'Technical Bulletin', type: 'documentType' },
  { id: 'licensing-forms', name: 'licensing-forms', displayName: 'Licensing Forms / Instructions', type: 'documentType' },
  { id: 'aml', name: 'aml', displayName: 'Anti-Money Laundering', type: 'documentType' },
  { id: 'data', name: 'data', displayName: 'Data', type: 'documentType' },
  { id: 'other', name: 'other', displayName: 'Other', type: 'documentType' }
]

export const ALL_CATEGORIES: CategoryItem[] = [...VERTICALS, ...DOCUMENT_TYPES]

export function getCategoryByName(name: string): CategoryItem | null {
  return ALL_CATEGORIES.find(cat => 
    cat.name.toLowerCase() === name.toLowerCase() || 
    cat.displayName.toLowerCase() === name.toLowerCase()
  ) || null
}

export function getCategoryById(id: string): CategoryItem | null {
  return ALL_CATEGORIES.find(cat => cat.id === id) || null
}