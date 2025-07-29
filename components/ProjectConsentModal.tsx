'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, CheckCircle, FileText } from 'lucide-react'

export function ProjectConsentModal() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors text-sm">
          Project info
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            MedGuardRx: Project Information & Consent
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Project Description */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Project Description
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Title:</h4>
                  <p className="text-sm text-muted-foreground">
                    MedGuard-Rx: Enhancing Medication Safety with Retrieval-Augmented Clinical QA
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Purpose of the Project:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This project aims to improve the quality and safety of clinical decision-making by using advanced AI models 
                    to answer medication-related clinical questions in real time. By analyzing anonymous queries submitted by 
                    clinicians during their practice, we seek to better understand the types of medication questions that arise 
                    and to evaluate the accuracy and safety of AI-generated responses. The insights gained will help optimize 
                    clinical question-answering systems and contribute to safer medication use.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">What Will Be Collected:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    When you use this application, the clinical queries you enter will be securely logged and stored. These 
                    queries will NOT include any patient-identifiable information (no names, birth dates, MRNs, or other PHI). 
                    Only the content of the query (e.g., "What is the recommended dose of metformin in renal failure?") and 
                    limited, non-identifying metadata (such as query timestamp) will be collected for research purposes.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">How Your Data Will Be Used:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The data collected will be used solely for research aimed at improving clinical question-answering systems. 
                    No attempt will be made to identify users or patients. Findings may be published or presented in scientific 
                    forums, but only aggregate and anonymized results will be shared.
                  </p>
                </div>
              </div>
            </div>

            {/* Consent Statement */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Consent to Participate in Research
              </h3>
              
              <p className="text-sm text-muted-foreground mb-4">
                By using this application, you acknowledge and agree to the following:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Your clinical queries entered into the application will be anonymously logged and stored for research 
                    and quality improvement purposes.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    No personally identifiable information (PHI) or patient data should be entered into the queries. 
                    Users are responsible for ensuring that queries are anonymized.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    The data will be analyzed in aggregate to evaluate and improve AI-powered clinical decision support tools.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Participation is voluntary. If you do not wish your queries to be used for research, do not use this application.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    There are no anticipated risks to participation since no identifiable information will be collected or used.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    If you have questions about the research or how your data is handled, you may contact the project team.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  By signing up for or using this application, you provide your consent for your queries to be used 
                  in the manner described above.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
