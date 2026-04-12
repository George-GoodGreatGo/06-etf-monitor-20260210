export type QuoteAuthor = 'Warren Buffett' | 'Charlie Munger' | 'Howard Marks'

export type QuoteItem = {
  id: string
  author: QuoteAuthor
  quoteZh: string
  quoteEn: string
  source: string
}

export const AUTHOR_META: Record<QuoteAuthor, { avatarText: string; displayName: string }> = {
  'Warren Buffett': { avatarText: 'WB', displayName: 'Warren Buffett' },
  'Charlie Munger': { avatarText: 'CM', displayName: 'Charlie Munger' },
  'Howard Marks': { avatarText: 'HM', displayName: 'Howard Marks' },
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
    id: 'buffett-tide-goes-out',
    author: 'Warren Buffett',
    quoteZh: '只有当潮水退去，你才会发现谁在裸泳。',
    quoteEn: "Only when the tide goes out do you discover who's been swimming naked.",
    source: 'Berkshire Hathaway (annual letter; commonly quoted)',
  },
  {
    id: 'buffett-forever',
    author: 'Warren Buffett',
    quoteZh: '我们最喜欢的持有期限是永远。',
    quoteEn: 'Our favorite holding period is forever.',
    source: 'Berkshire Hathaway (annual meeting; commonly quoted)',
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
    id: 'munger-incentives',
    author: 'Charlie Munger',
    quoteZh: '告诉我激励是什么，我就能告诉你结果是什么。',
    quoteEn: 'Show me the incentive and I will show you the outcome.',
    source: 'Poor Charlie’s Almanack (selected talks)',
  },
  {
    id: 'munger-simple-idea',
    author: 'Charlie Munger',
    quoteZh: '把一个简单的想法当回事。',
    quoteEn: 'Take a simple idea and take it seriously.',
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
  {
    id: 'marks-risk-leftover',
    author: 'Howard Marks',
    quoteZh: '风险是当你以为自己考虑周全之后，仍然剩下的东西。',
    quoteEn: "Risk is what's left over when you think you've thought of everything.",
    source: 'The Most Important Thing (Howard Marks)',
  },
  {
    id: 'marks-cant-do-same',
    author: 'Howard Marks',
    quoteZh: '如果你做的和别人一样，就很难获得更好的结果。',
    quoteEn: "You can't do the same things others do and expect to outperform.",
    source: 'Oaktree memos (commonly quoted)',
  },
]

