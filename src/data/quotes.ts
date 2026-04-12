export type QuoteAuthor = 'Warren Buffett' | 'Charlie Munger' | 'Howard Marks'

export type QuoteItem = {
  id: string
  author: QuoteAuthor
  quoteZh: string
  quoteEn: string
  source: string
}

export const QUOTES: QuoteItem[] = [
  {
    id: 'buffett-1986-fearful-greedy',
    author: 'Warren Buffett',
    quoteZh: '我们只是试图在别人贪婪时恐惧，在别人恐惧时贪婪。',
    quoteEn: 'Be fearful when others are greedy and be greedy only when others are fearful.',
    source: 'Berkshire Hathaway Shareholder Letter (1986)',
  },
  {
    id: 'buffett-price-value',
    author: 'Warren Buffett',
    quoteZh: '价格是你付出的，价值是你得到的。',
    quoteEn: 'Price is what you pay. Value is what you get.',
    source: 'Berkshire Hathaway Shareholder Letter (2008)',
  },
  {
    id: 'buffett-margin-of-safety',
    author: 'Warren Buffett',
    quoteZh: '投资的三条准则：第一，永远不要亏钱；第二，永远不要忘记第一条。',
    quoteEn: "Rule No.1: Never lose money. Rule No.2: Never forget rule No.1.",
    source: 'Commonly attributed quote (source varies)',
  },
  {
    id: 'munger-waiting',
    author: 'Charlie Munger',
    quoteZh: '赚大钱不在于买卖频繁，而在于等待。',
    quoteEn: 'The big money is not in the buying and selling, but in the waiting.',
    source: 'Commonly attributed quote (source varies)',
  },
  {
    id: 'munger-sit-tight',
    author: 'Charlie Munger',
    quoteZh: '如果你知道自己在做什么，就坐得住。',
    quoteEn: "If you know what you're doing, you can sit tight.",
    source: 'Commonly attributed quote (source varies)',
  },
  {
    id: 'munger-avoid-stupidity',
    author: 'Charlie Munger',
    quoteZh: '我更关注避免愚蠢，而不是追求聪明。',
    quoteEn: "I think I've been in the top 5% of my age cohort all my life in understanding that I don't have to be smart; I just have to avoid being stupid.",
    source: 'Poor Charlie’s Almanack (selected talks)',
  },
  {
    id: 'marks-risk-first',
    author: 'Howard Marks',
    quoteZh: '关注风险，比预测回报更重要。',
    quoteEn: 'If we avoid the losers, the winners will take care of themselves.',
    source: 'The Most Important Thing (Howard Marks)',
  },
  {
    id: 'marks-cycle',
    author: 'Howard Marks',
    quoteZh: '你无法预测，但你可以做好准备。',
    quoteEn: "You can't predict. You can prepare.",
    source: 'The Most Important Thing (Howard Marks)',
  },
  {
    id: 'marks-second-level',
    author: 'Howard Marks',
    quoteZh: '真正的优势来自二层思维。',
    quoteEn: 'Superior investing requires second-level thinking.',
    source: 'The Most Important Thing (Howard Marks)',
  },
]

