import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MedGuardRx - Enhancing Medication Safety',
  description: 'MedGuardRx: Enhancing Medication Safety with Retrieval-Augmented Clinical QA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.className} min-h-screen bg-[#111113]`}>
        <Providers>
          <div className="min-h-screen bg-[#111113]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
