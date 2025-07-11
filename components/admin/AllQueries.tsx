'use client'

import { useState } from 'react'
import { AdminQueryHistory } from '@/components/admin-query-history'
import { MedicationQueryForm } from '@/components/medication-query-form'

interface QueryWithUser {
  id: string
  user_query: string
  medication_name: string
  ai_response: string
  created_at: string
  message_count: number
  profiles?: {
    email: string
    full_name: string
  }
  email: string
  full_name: string
}

export function AllQueries() {
  const [selectedQuery, setSelectedQuery] = useState<QueryWithUser | null>(null)

  const handleQuerySelect = (query: QueryWithUser) => {
    setSelectedQuery(query)
  }

  const handleBackToList = () => {
    setSelectedQuery(null)
  }

  if (selectedQuery) {
    return (
      <div className="space-y-4">
        <button 
          onClick={handleBackToList}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
        >
          ← Back to All Queries
        </button>
        <MedicationQueryForm 
          isAdminView={true}
          viewOnlyQuery={selectedQuery}
        />
      </div>
    )
  }

  return (
    <AdminQueryHistory 
      onSelectQuery={handleQuerySelect}
      selectedQuery={selectedQuery}
      onCreatePersonalQuery={() => {}}
    />
  )
}
