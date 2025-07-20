import './auth-layout.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#111113] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
