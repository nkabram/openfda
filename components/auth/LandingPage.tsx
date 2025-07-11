'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Zap, Database, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { AuthScreen } from './AuthScreen'
import { ThemeToggle } from '@/components/theme-toggle'

export function LandingPage() {
  const [showAuthScreen, setShowAuthScreen] = useState(false)

  if (showAuthScreen) {
    return <AuthScreen />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MedGuardRx</h1>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Button onClick={() => setShowAuthScreen(true)} className="bg-blue-600 hover:bg-blue-700">
              Sign In / Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Enhancing Medication Safety with AI
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              MedGuardRx uses advanced AI models to answer medication-related clinical questions in real time, 
              helping improve the quality and safety of clinical decision-making.
            </p>
            <Button 
              onClick={() => setShowAuthScreen(true)} 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Key Features
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="h-6 w-6 text-blue-600" />
                  <CardTitle>FDA Data Integration</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Access comprehensive medication information directly from FDA databases with real-time queries.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Zap className="h-6 w-6 text-green-600" />
                  <CardTitle>AI-Powered Responses</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Get intelligent, contextual answers to medication questions using advanced AI technology.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Shield className="h-6 w-6 text-purple-600" />
                  <CardTitle>Safety Focused</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Designed with clinical safety in mind, providing reliable information for healthcare decisions.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Project Description Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Project Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-2">Purpose of the Project:</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  This project aims to improve the quality and safety of clinical decision-making by using advanced AI models 
                  to answer medication-related clinical questions in real time. By analyzing anonymous queries submitted by 
                  clinicians during their practice, we seek to better understand the types of medication questions that arise 
                  and to evaluate the accuracy and safety of AI-generated responses. The insights gained will help optimize 
                  clinical question-answering systems and contribute to safer medication use.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-2">What Will Be Collected:</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  When you use this application, the clinical queries you enter will be securely logged and stored. These 
                  queries will NOT include any patient-identifiable information (no names, birth dates, MRNs, or other PHI). 
                  Only the content of the query (e.g., "What is the recommended dose of metformin in renal failure?") and 
                  limited, non-identifying metadata (such as query timestamp) will be collected for research purposes.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-2">How Your Data Will Be Used:</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  The data collected will be used solely for research aimed at improving clinical question-answering systems. 
                  No attempt will be made to identify users or patients. Findings may be published or presented in scientific 
                  forums, but only aggregate and anonymized results will be shared.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Consent Section */}
      <section className="py-16 px-4 bg-blue-50 dark:bg-gray-800">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center flex items-center justify-center space-x-2">
                <Users className="h-6 w-6" />
                <span>Consent to Participate in Research</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                By using this application, you acknowledge and agree to the following:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300">
                    Your clinical queries entered into the application will be anonymously logged and stored for research 
                    and quality improvement purposes.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300">
                    No personally identifiable information (PHI) or patient data should be entered into the queries. 
                    Users are responsible for ensuring that queries are anonymized.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300">
                    The data will be analyzed in aggregate to evaluate and improve AI-powered clinical decision support tools.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300">
                    Participation is voluntary. If you do not wish your queries to be used for research, do not use this application.
                  </p>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600 dark:text-gray-300">
                    There are no anticipated risks to participation since no identifiable information will be collected or used.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 font-medium text-center">
                  By signing up for or using this application, you provide your consent for your queries to be used 
                  in the manner described above.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to Get Started?
          </h3>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Join our research initiative and help improve medication safety through AI.
          </p>
          <Button 
            onClick={() => setShowAuthScreen(true)} 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3"
          >
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">MedGuardRx</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enhancing Medication Safety with Retrieval-Augmented Clinical QA
          </p>
        </div>
      </footer>
    </div>
  )
}
