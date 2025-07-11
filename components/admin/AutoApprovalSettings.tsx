'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Shield, Users, CheckCircle, Plus, X, Mail, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AutoApprovalDomain {
  domain: string
  description?: string
}

interface TrustedDomain {
  id: string
  domain: string
  created_at: string
}

interface WhitelistedEmail {
  id: string
  email: string
  created_at: string
}

export function AutoApprovalSettings() {
  const [isApplying, setIsApplying] = useState(false)
  const [trustedDomains, setTrustedDomains] = useState<TrustedDomain[]>([])
  const [whitelistedEmails, setWhitelistedEmails] = useState<WhitelistedEmail[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { session } = useAuth()

  useEffect(() => {
    fetchAutoApprovalData()
  }, [])

  const fetchAutoApprovalData = async () => {
    try {
      if (!session) return

      // Fetch trusted domains
      const domainsResponse = await fetch('/api/admin/trusted-domains', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (domainsResponse.ok) {
        const { domains } = await domainsResponse.json()
        setTrustedDomains(domains || [])
      }

      // Fetch email whitelist
      const emailsResponse = await fetch('/api/admin/email-whitelist', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (emailsResponse.ok) {
        const { emails } = await emailsResponse.json()
        setWhitelistedEmails(emails || [])
      }
    } catch (error) {
      console.error('Error fetching auto-approval data:', error)
      toast.error('Failed to load auto-approval settings')
    } finally {
      setIsLoading(false)
    }
  }

  const addTrustedDomain = async () => {
    if (!newDomain.trim()) return

    try {
      if (!session) return

      const response = await fetch('/api/admin/trusted-domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain: newDomain.trim() })
      })

      if (response.ok) {
        const { domain } = await response.json()
        setTrustedDomains([...trustedDomains, domain])
        setNewDomain('')
        toast.success('Domain added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add domain')
      }
    } catch (error) {
      console.error('Error adding domain:', error)
      toast.error('Failed to add domain')
    }
  }

  const removeTrustedDomain = async (id: string) => {
    try {
      if (!session) return

      const response = await fetch(`/api/admin/trusted-domains?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        setTrustedDomains(trustedDomains.filter(d => d.id !== id))
        toast.success('Domain removed successfully')
      } else {
        toast.error('Failed to remove domain')
      }
    } catch (error) {
      console.error('Error removing domain:', error)
      toast.error('Failed to remove domain')
    }
  }

  const addWhitelistedEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return

    try {
      if (!session) return

      const response = await fetch('/api/admin/email-whitelist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newEmail.trim() })
      })

      if (response.ok) {
        const { email } = await response.json()
        setWhitelistedEmails([...whitelistedEmails, email])
        setNewEmail('')
        toast.success('Email added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add email')
      }
    } catch (error) {
      console.error('Error adding email:', error)
      toast.error('Failed to add email')
    }
  }

  const removeWhitelistedEmail = async (id: string) => {
    try {
      if (!session) return

      const response = await fetch(`/api/admin/email-whitelist?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        setWhitelistedEmails(whitelistedEmails.filter(e => e.id !== id))
        toast.success('Email removed successfully')
      } else {
        toast.error('Failed to remove email')
      }
    } catch (error) {
      console.error('Error removing email:', error)
      toast.error('Failed to remove email')
    }
  }

  const handleApplyAutoApproval = async () => {
    if (!session) return
    
    setIsApplying(true)
    try {
      const response = await fetch('/api/admin/auto-approve-domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || "Auto-approval applied successfully")
      } else {
        throw new Error('Failed to apply auto-approval')
      }
    } catch (error) {
      console.error('Error applying auto-approval:', error)
      toast.error('Failed to apply auto-approval')
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auto-Approval Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Trusted Domains Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Trusted Domains
          </CardTitle>
          <CardDescription>
            Users with email addresses from these domains are automatically approved
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTrustedDomain()}
            />
            <Button onClick={addTrustedDomain} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {trustedDomains.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {domain.domain}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTrustedDomain(domain.id)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {trustedDomains.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No trusted domains configured
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Whitelist Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Whitelist
          </CardTitle>
          <CardDescription>
            Specific email addresses that are automatically approved
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addWhitelistedEmail()}
            />
            <Button onClick={addWhitelistedEmail} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {whitelistedEmails.map((email) => (
              <div key={email.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {email.email}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWhitelistedEmail(email.id)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {whitelistedEmails.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No whitelisted emails configured
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apply Auto-Approval Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Apply Auto-Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleApplyAutoApproval}
            disabled={isApplying}
            className="w-full"
          >
            <Users className="h-4 w-4 mr-2" />
            {isApplying ? 'Applying...' : 'Apply Auto-Approval to Existing Users'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will automatically approve all existing users with email addresses from trusted domains or in the email whitelist.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
