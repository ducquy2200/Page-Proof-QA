import { useState } from 'react'
import { Send } from 'lucide-react'
import { useQA } from '../../hooks/useQA'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'

export default function QuestionInput() {
  const [question, setQuestion] = useState('')
  const { ask, loading } = useQA()
  const documentStatus = useAppStore((s) => s.documentStatus)
  const { c } = useTheme()
  const ready = documentStatus === 'ready'

  const handleSubmit = async () => {
    if (!question.trim() || loading) return
    await ask(question)
    setQuestion('')
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-[0.2em]" style={{ color: c.textMuted }}>
        Ask a question
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={ready ? 'e.g. Who signed the discharge on April 6?' : 'Waiting for document...'}
          disabled={!ready || loading}
          rows={3}
          className="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none"
          style={{
            backgroundColor: c.bgInput,
            border: `1px solid ${c.borderMid}`,
            color: c.textPrimary,
            caretColor: c.accent,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = c.accent
          }}
          onBlur={(e) => {
            e.target.style.borderColor = c.borderMid
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={!ready || loading || !question.trim()}
          className="self-end sm:self-end min-w-20"
        >
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Send size={14} />
              <span className="text-xs uppercase tracking-[0.14em]">Ask</span>
            </>
          )}
        </Button>
      </div>
      <p className="text-xs tracking-wide" style={{ color: c.textFaint }}>
        Enter to submit. Shift+Enter for newline.
      </p>
    </div>
  )
}
