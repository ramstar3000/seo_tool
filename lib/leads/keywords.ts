export interface KeywordTemplate {
  keyword: string;
  category: string;
  location: string;
}

export const LONDON_KEYWORDS: KeywordTemplate[] = [
  { keyword: 'plumber Camden', category: 'plumber', location: 'Camden' },
  { keyword: 'plumber Hackney', category: 'plumber', location: 'Hackney' },
  { keyword: 'electrician Islington', category: 'electrician', location: 'Islington' },
  { keyword: 'electrician Greenwich', category: 'electrician', location: 'Greenwich' },
  { keyword: 'solicitor City of London', category: 'solicitor', location: 'City of London' },
  { keyword: 'accountant Canary Wharf', category: 'accountant', location: 'Canary Wharf' },
  { keyword: 'coffee shop Shoreditch', category: 'cafe', location: 'Shoreditch' },
  { keyword: 'restaurant Soho', category: 'restaurant', location: 'Soho' },
  { keyword: 'dentist Clapham', category: 'dentist', location: 'Clapham' },
  { keyword: 'physio Wimbledon', category: 'physio', location: 'Wimbledon' },
  { keyword: 'gym Camden', category: 'gym', location: 'Camden' },
  { keyword: 'plumber Clapham', category: 'plumber', location: 'Clapham' },
  { keyword: 'dentist Shoreditch', category: 'dentist', location: 'Shoreditch' },
  { keyword: 'restaurant Camden', category: 'restaurant', location: 'Camden' },
  { keyword: 'solicitor Westminster', category: 'solicitor', location: 'Westminster' },
  { keyword: 'gym Shoreditch', category: 'gym', location: 'Shoreditch' },
  { keyword: 'cafe Clapham', category: 'cafe', location: 'Clapham' },
  { keyword: 'accountant Shoreditch', category: 'accountant', location: 'Shoreditch' },
];

export function getLondonKeywordStrings(): string[] {
  return LONDON_KEYWORDS.map((k) => k.keyword);
}

export function findKeywordTemplate(keyword: string): KeywordTemplate | undefined {
  return LONDON_KEYWORDS.find((k) => k.keyword === keyword);
}
