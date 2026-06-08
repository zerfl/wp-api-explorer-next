export interface QuickConnectSite {
  name: string;
  url: string;
  description: string;
  defaultProxy: boolean;
}

export const QUICK_CONNECT_SITES: QuickConnectSite[] = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com",
    description: "Famous tech startup news publication. Supports direct CORS requests.",
    defaultProxy: false
  },
  {
    name: "WordPress.org News",
    url: "https://wordpress.org/news",
    description: "Official WordPress platform updates and announcements.",
    defaultProxy: false
  },
  {
    name: "WP Tavern",
    url: "https://wptavern.com",
    description: "WordPress community news site (great for testing proxy mode).",
    defaultProxy: false
  },
  {
    name: "CSS-Tricks",
    url: "https://css-tricks.com",
    description: "Popular web design and development publication.",
    defaultProxy: false
  }
];
