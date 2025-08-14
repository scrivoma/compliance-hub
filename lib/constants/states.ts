export interface State {
  code: string
  name: string
  abbreviation?: string
}

export const US_STATES: State[] = [
  { code: 'AL', name: 'Alabama', abbreviation: 'AL' },
  { code: 'AK', name: 'Alaska', abbreviation: 'AK' },
  { code: 'AZ', name: 'Arizona', abbreviation: 'AZ' },
  { code: 'AR', name: 'Arkansas', abbreviation: 'AR' },
  { code: 'CA', name: 'California', abbreviation: 'CA' },
  { code: 'CO', name: 'Colorado', abbreviation: 'CO' },
  { code: 'CT', name: 'Connecticut', abbreviation: 'CT' },
  { code: 'DE', name: 'Delaware', abbreviation: 'DE' },
  { code: 'FL', name: 'Florida', abbreviation: 'FL' },
  { code: 'GA', name: 'Georgia', abbreviation: 'GA' },
  { code: 'HI', name: 'Hawaii', abbreviation: 'HI' },
  { code: 'ID', name: 'Idaho', abbreviation: 'ID' },
  { code: 'IL', name: 'Illinois', abbreviation: 'IL' },
  { code: 'IN', name: 'Indiana', abbreviation: 'IN' },
  { code: 'IA', name: 'Iowa', abbreviation: 'IA' },
  { code: 'KS', name: 'Kansas', abbreviation: 'KS' },
  { code: 'KY', name: 'Kentucky', abbreviation: 'KY' },
  { code: 'LA', name: 'Louisiana', abbreviation: 'LA' },
  { code: 'ME', name: 'Maine', abbreviation: 'ME' },
  { code: 'MD', name: 'Maryland', abbreviation: 'MD' },
  { code: 'MA', name: 'Massachusetts', abbreviation: 'MA' },
  { code: 'MI', name: 'Michigan', abbreviation: 'MI' },
  { code: 'MN', name: 'Minnesota', abbreviation: 'MN' },
  { code: 'MS', name: 'Mississippi', abbreviation: 'MS' },
  { code: 'MO', name: 'Missouri', abbreviation: 'MO' },
  { code: 'MT', name: 'Montana', abbreviation: 'MT' },
  { code: 'NE', name: 'Nebraska', abbreviation: 'NE' },
  { code: 'NV', name: 'Nevada', abbreviation: 'NV' },
  { code: 'NH', name: 'New Hampshire', abbreviation: 'NH' },
  { code: 'NJ', name: 'New Jersey', abbreviation: 'NJ' },
  { code: 'NM', name: 'New Mexico', abbreviation: 'NM' },
  { code: 'NY', name: 'New York', abbreviation: 'NY' },
  { code: 'NC', name: 'North Carolina', abbreviation: 'NC' },
  { code: 'ND', name: 'North Dakota', abbreviation: 'ND' },
  { code: 'OH', name: 'Ohio', abbreviation: 'OH' },
  { code: 'OK', name: 'Oklahoma', abbreviation: 'OK' },
  { code: 'OR', name: 'Oregon', abbreviation: 'OR' },
  { code: 'PA', name: 'Pennsylvania', abbreviation: 'PA' },
  { code: 'RI', name: 'Rhode Island', abbreviation: 'RI' },
  { code: 'SC', name: 'South Carolina', abbreviation: 'SC' },
  { code: 'SD', name: 'South Dakota', abbreviation: 'SD' },
  { code: 'TN', name: 'Tennessee', abbreviation: 'TN' },
  { code: 'TX', name: 'Texas', abbreviation: 'TX' },
  { code: 'UT', name: 'Utah', abbreviation: 'UT' },
  { code: 'VT', name: 'Vermont', abbreviation: 'VT' },
  { code: 'VA', name: 'Virginia', abbreviation: 'VA' },
  { code: 'WA', name: 'Washington', abbreviation: 'WA' },
  { code: 'WV', name: 'West Virginia', abbreviation: 'WV' },
  { code: 'WI', name: 'Wisconsin', abbreviation: 'WI' },
  { code: 'WY', name: 'Wyoming', abbreviation: 'WY' }
]

export const SPECIAL_STATE_OPTIONS = [
  { code: 'ALL', name: 'Compare All States', abbreviation: 'ALL' },
  { code: 'MULTIPLE', name: 'Select Multiple States', abbreviation: 'MULTI' }
]

export const ALL_STATE_OPTIONS = [...SPECIAL_STATE_OPTIONS, ...US_STATES]

export function getStateByCode(code: string): State | undefined {
  return ALL_STATE_OPTIONS.find(state => state.code === code)
}

export function getStateDisplayName(code: string): string {
  const state = getStateByCode(code)
  return state ? state.name : code
}