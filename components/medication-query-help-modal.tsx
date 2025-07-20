'use client'

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MessageCircleQuestion } from "lucide-react"

export function MedicationQueryHelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <MessageCircleQuestion className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How to Use the Medication Query Tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Getting Started</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Ask any question about medications, side effects, interactions, dosages, and more. Our AI will search FDA documents to provide you with accurate, evidence-based information.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Example Questions</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>"What are the side effects of ibuprofen?"</li>
              <li>"Can I take aspirin with food?"</li>
              <li>"What is the recommended dosage for acetaminophen?"</li>
              <li>"Are there any drug interactions with warfarin?"</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Follow-up Questions</h4>
            <p className="text-sm text-muted-foreground">
              After receiving a response, you can ask follow-up questions to get more specific information. 
              The system will maintain context from your previous questions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Tips for Best Results</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Be specific with your questions</li>
              <li>Include the medication name and what you want to know</li>
              <li>Ask one question at a time for clearer answers</li>
              <li>Check the FDA source information for official documentation</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
