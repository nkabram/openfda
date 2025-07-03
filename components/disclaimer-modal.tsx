'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'

export function DisclaimerModal() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-yellow-500 hover:text-yellow-400 dark:text-yellow-400 dark:hover:text-yellow-300 underline transition-colors text-sm">
          Disclaimer
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Important Disclaimer
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            ⚠️ This information is for educational purposes only and should not replace professional medical advice. 
            Always consult with a healthcare provider before making any changes to your medication regimen.
          </p>
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              The information provided through this application is sourced from FDA databases and AI-generated responses. 
              While we strive for accuracy, this tool should not be used as a substitute for professional medical advice, 
              diagnosis, or treatment.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
