'use client'

import { AdminGuard } from '@/components/auth/AdminGuard'
import { UserApproval } from '@/components/admin/UserApproval'
import { AllQueries } from '@/components/admin/AllQueries'
import { AutoApprovalSettings } from '@/components/admin/AutoApprovalSettings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AdminPage() {
  return (
    <AdminGuard>
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        <Tabs defaultValue="user-approval">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user-approval">User Approval</TabsTrigger>
            <TabsTrigger value="all-queries">All Queries</TabsTrigger>
            <TabsTrigger value="auto-approval">Auto-Approval</TabsTrigger>
          </TabsList>
          <TabsContent value="user-approval">
            <UserApproval />
          </TabsContent>
          <TabsContent value="all-queries">
            <AllQueries />
          </TabsContent>
          <TabsContent value="auto-approval">
            <AutoApprovalSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  )
}
