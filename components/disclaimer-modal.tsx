'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function DisclaimerModal() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-yellow-500 hover:text-yellow-400 dark:text-yellow-400 dark:hover:text-yellow-300 underline transition-colors text-sm">
          Disclaimer
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Important Disclaimer
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            ⚠️ This information is for educational purposes only and should not replace professional medical advice. 
            Always consult with a healthcare provider before making any changes to your medication regimen.
          </p>
          
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-800 dark:text-red-200 font-semibold mb-2">
              ⚠️ FDA CLINICAL DECISION DISCLAIMER:
            </p>
            <p className="text-xs text-red-800 dark:text-red-200">
              The FDA does not recommend using this information for clinical decision making. 
              Do not rely on openFDA data to make decisions regarding medical care. While we make every effort 
              to ensure that data is accurate, you should assume all results are unvalidated.
            </p>
          </div>
          
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              The information provided through this application is sourced from FDA databases and AI-generated responses. 
              While we strive for accuracy, this tool should not be used as a substitute for professional medical advice, 
              diagnosis, or treatment.
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>OpenFDA Terms:</strong> The openFDA platform is provided "as is" and on an "as-available" basis. 
              FDA disclaims all warranties and makes no warranty that openFDA data will be error-free or that access 
              will be continuous or uninterrupted. Data provided by the U.S. Food and Drug Administration.
            </p>
          </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
