/**
 * Editorial journal posts (sample dataset). Powers /journal and feeds
 * BlogPosting JSON-LD. Replace with a CMS / backend blog feed later.
 */
export type JournalPost = {
  slug: string
  title: string
  excerpt: string
  body: string[]
  category: string
  readingMinutes: number
  date: string // ISO
}

export const journalPosts: JournalPost[] = [
  {
    slug: "how-to-read-a-whisky-label",
    title: "چطور برچسب یک ویسکی را بخوانیم",
    excerpt: "از «تک‌مالت» تا «کَسک‌استرنث» — راهنمای کوتاهِ واژگانِ روی بطری.",
    category: "راهنما",
    readingMinutes: 6,
    date: "2026-05-20",
    body: [
      "برچسب ویسکی پر از واژه‌هایی است که هرکدام چیزی دربارهٔ شیوهٔ ساخت و طعم به ما می‌گویند.",
      "«تک‌مالت» یعنی محصول تنها از یک تقطیرخانه و تنها از جوِ مالت‌شده تهیه شده است.",
      "«کَسک‌استرنث» یعنی ویسکی بدون رقیق‌سازی و با درصد الکلِ طبیعیِ بشکه بطری شده — پرشورتر و غلیظ‌تر.",
    ],
  },
  {
    slug: "grower-champagne-explained",
    title: "شامپاینِ تولیدکننده چیست؟",
    excerpt: "چرا شامپاینِ تولیدکننده طرفداران پروپاقرص دارد.",
    category: "آموزش",
    readingMinutes: 5,
    date: "2026-05-04",
    body: [
      "در شامپاینِ تولیدکننده، همان کسی که انگور را پرورش می‌دهد، شامپاین را هم می‌سازد.",
      "نتیجه معمولاً بازتابِ دقیق‌ترِ خاک و باغ است؛ تولیدهای کوچک و شخصیت‌محور.",
    ],
  },
  {
    slug: "serving-temperatures",
    title: "دمای درستِ سِرو",
    excerpt: "هر نوشیدنی دمای ایده‌آل خودش را دارد.",
    category: "راهنما",
    readingMinutes: 4,
    date: "2026-04-18",
    body: [
      "شامپاین را خنک (۸ تا ۱۰ درجه) سِرو کنید تا حباب‌ها ظریف بمانند.",
      "ویسکی را در دمای اتاق یا با یک تکه یخِ بزرگ بنوشید تا عطرش باز شود.",
    ],
  },
]

export function getPost(slug: string): JournalPost | undefined {
  return journalPosts.find((p) => p.slug === slug)
}
