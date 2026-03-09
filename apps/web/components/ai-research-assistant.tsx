'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const API = 'http://localhost:8000'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

interface AIAssistantProps {
  token: string
  currentRunId?: string
  onClose: () => void
}

export function AIResearchAssistant({ token, currentRunId, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your **BioOS Research Assistant** — powered by Claude AI.\n\nI can guide you through building your pipeline, explain results, and answer deep scientific questions.\n\n**Try asking me:**\n• "Which tools should I use for a GPCR target?"\n• "What pLDDT score is considered high confidence?"\n• "How do I interpret DiffDock binding affinity scores?"\n• "What ADMET properties matter most for CNS drugs?"\n• "Should I use AlphaFold 3 or ESMFold for my 200-residue protein?"',
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'chat' | 'analyze' | 'optimize'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: input,
          context: currentRunId ? { run_id: currentRunId } : null,
          history: messages.slice(-10)
        })
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.error) {
                setMessages(prev => prev.map((msg, idx) => 
                  idx === prev.length - 1 
                    ? { ...msg, content: `❌ ${data.error}`, isStreaming: false }
                    : msg
                ))
                break
              }

              if (data.done) {
                setMessages(prev => prev.map((msg, idx) => 
                  idx === prev.length - 1 
                    ? { ...msg, isStreaming: false }
                    : msg
                ))
                break
              }

              if (data.content) {
                setMessages(prev => prev.map((msg, idx) => 
                  idx === prev.length - 1 
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ))
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e)
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 
          ? { 
              ...msg, 
              content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
              isStreaming: false 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeResults = async () => {
    if (!currentRunId) {
      alert('No pipeline run context available. Please select a pipeline run to analyze.')
      return
    }

    setIsLoading(true)
    const analysisMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    }

    setMessages(prev => [...prev, analysisMessage])

    try {
      const response = await fetch(`${API}/api/ai/explain/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          run_id: currentRunId,
          question: "Please provide a comprehensive analysis of these pipeline results"
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 
          ? { 
              ...msg, 
              content: `🔬 **Pipeline Results Analysis**\n\n${data.explanation}`,
              isStreaming: false 
            }
          : msg
      ))
    } catch (error) {
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 
          ? { 
              ...msg, 
              content: `❌ Failed to analyze results: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isStreaming: false 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const getOptimizationSuggestions = async () => {
    if (!currentRunId) {
      alert('No pipeline run context available. Please select a pipeline run to optimize.')
      return
    }

    setIsLoading(true)
    const optimizationMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    }

    setMessages(prev => [...prev, optimizationMessage])

    try {
      const response = await fetch(`${API}/api/ai/suggestions/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          run_id: currentRunId
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 
          ? { 
              ...msg, 
              content: `⚡ **Optimization Suggestions**\n\n${data.suggestions}`,
              isStreaming: false 
            }
          : msg
      ))
    } catch (error) {
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 
          ? { 
              ...msg, 
              content: `❌ Failed to generate optimization suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isStreaming: false 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 rounded">$1</code>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col bg-background border-border shadow-2xl">
        <CardHeader className="border-b border-border bg-secondary/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg">AI Research Assistant</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Powered by Claude AI • {currentRunId ? 'Context: Current Pipeline' : 'General Mode'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 pt-3">
            {currentRunId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={analyzeResults}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  Analyze Results
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getOptimizationSuggestions}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  Optimize
                </Button>
              </>
            )}
            <Badge variant="secondary" className="text-xs">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Online
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  message.role === 'user' 
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-violet-500/20"
                )}>
                  {message.role === 'user' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  )}
                </div>

                <div className={cn(
                  "max-w-[70%] rounded-xl px-4 py-3 relative",
                  message.role === 'user'
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-foreground"
                    : "bg-secondary/50 border border-border text-foreground"
                )}>
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessage(message.content) 
                    }}
                  />
                  
                  {message.isStreaming && (
                    <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-current rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                      <span className="text-xs">AI is thinking...</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            {/* Quick prompt chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { label: 'Best tools for my target?', prompt: 'Which pipeline tools do you recommend for a kinase target?' },
                { label: 'Explain pLDDT scores', prompt: 'Explain pLDDT confidence scores in AlphaFold predictions.' },
                { label: 'ADMET for CNS drugs', prompt: 'What ADMET properties are most critical for CNS drug candidates?' },
                { label: 'AlphaFold vs ESMFold', prompt: 'When should I use AlphaFold 3 versus ESMFold?' },
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => { setInput(chip.prompt); inputRef.current?.focus() }}
                  disabled={isLoading}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about tools, sequences, ADMET, docking scores…"
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 2-7 20-4-9-9-4z" />
                    <path d="M22 2 11 13" />
                  </svg>
                )}
              </Button>
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Press Enter to send • Shift+Enter for new line</span>
              {currentRunId && (
                <span className="text-emerald-400">Pipeline context active</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}