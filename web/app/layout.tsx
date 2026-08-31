import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hdb-resale-insight.equal-cove-8327.chatgpt.site'),
  title: 'HDB Resale Insight | 新加坡组屋转售价格估算',
  description: '基于新加坡 HDB 官方转售交易数据的价格区间估算与地区趋势分析。',
  openGraph: {
    title: 'HDB Resale Insight',
    description: '新加坡 HDB 转售价格区间估算与地区趋势分析。',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'HDB Resale Insight' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HDB Resale Insight',
    description: '新加坡 HDB 转售价格区间估算与地区趋势分析。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
