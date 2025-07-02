'use client'

import { useState } from 'react'
import { MedicationQueryForm } from '../components/medication-query-form'
import { QueryHistory } from '../components/query-history'
import { Button } from '../components/ui/button'
import { Menu, X } from 'lucide-react'

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border`}>
          <div className="h-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Query History</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <QueryHistory />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isSidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <h1 className="text-xl font-bold">OpenFDA Medication QA</h1>
            </div>
          </div>
          
          <div className="p-6">
            <MedicationQueryForm />
          </div>
        </div>
      </div>
    </div>
  )
}
