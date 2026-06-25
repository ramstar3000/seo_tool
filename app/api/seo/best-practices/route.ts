import { NextResponse } from 'next/server';
import {
  getPracticesByCategory,
  getPracticeCategories,
  SEO_BEST_PRACTICES,
} from '@/lib/seo/best-practices';

export const runtime = 'edge';

export async function GET() {
  const highPriorityCount = SEO_BEST_PRACTICES.filter((p) => p.priority === 'high').length;

  return NextResponse.json({
    success: true,
    count: SEO_BEST_PRACTICES.length,
    categories: getPracticeCategories(),
    highPriorityCount,
    practices: SEO_BEST_PRACTICES,
    byCategory: getPracticesByCategory(),
  });
}
