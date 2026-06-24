import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionInput } from './QuestionInput'
import type { QuestionAnswer, QuestionDef } from '@/types/inspection'

function makeQuestion(overrides: Partial<QuestionDef> = {}): QuestionDef {
  return {
    id: 'q-1',
    index: 0,
    question: 'Test question',
    isRequired: false,
    answerType: 'TEXT',
    value: null,
    ...overrides,
  }
}

function makeAnswer(overrides: Partial<QuestionAnswer> = {}): QuestionAnswer {
  return {
    id: 'qa-1',
    questionId: 'q-1',
    answer: '',
    note: null,
    mediaFiles: null,
    question: { id: 'q-1', question: 'Test question', answerType: 'TEXT', value: null },
    ...overrides,
  }
}

describe('QuestionInput', () => {
  describe('TEXT type', () => {
    it('renders a text input', () => {
      render(<QuestionInput question={makeQuestion()} answer={makeAnswer()} onChange={vi.fn()} />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('calls onChange with qaId and value on blur', async () => {
      const onChange = vi.fn()
      render(<QuestionInput question={makeQuestion()} answer={makeAnswer({ answer: '' })} onChange={onChange} />)
      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'hello')
      await userEvent.tab()
      expect(onChange).toHaveBeenCalledWith('qa-1', 'hello')
    })

    it('pre-fills from existing answer', () => {
      render(<QuestionInput question={makeQuestion()} answer={makeAnswer({ answer: 'existing' })} onChange={vi.fn()} />)
      expect(screen.getByRole('textbox')).toHaveValue('existing')
    })

    it('is disabled when disabled prop is true', () => {
      render(<QuestionInput question={makeQuestion()} answer={makeAnswer()} onChange={vi.fn()} disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  describe('PARAGRAPH type', () => {
    it('renders a textarea', () => {
      render(<QuestionInput question={makeQuestion({ answerType: 'PARAGRAPH' })} answer={makeAnswer()} onChange={vi.fn()} />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      // textarea has rows attribute
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
    })
  })

  describe('CHECKBOX type', () => {
    const question = makeQuestion({ answerType: 'CHECKBOX', value: ['Option A', 'Option B', 'Option C'] })

    it('renders a checkbox per option', () => {
      render(<QuestionInput question={question} answer={makeAnswer({ answer: [] })} onChange={vi.fn()} />)
      expect(screen.getAllByRole('checkbox')).toHaveLength(3)
      expect(screen.getByLabelText('Option A')).toBeInTheDocument()
    })

    it('pre-checks already-selected options', () => {
      render(<QuestionInput question={question} answer={makeAnswer({ answer: ['Option B'] })} onChange={vi.fn()} />)
      expect(screen.getByLabelText('Option A')).not.toBeChecked()
      expect(screen.getByLabelText('Option B')).toBeChecked()
    })

    it('calls onChange with updated array when an option is toggled on', async () => {
      const onChange = vi.fn()
      render(<QuestionInput question={question} answer={makeAnswer({ answer: [] })} onChange={onChange} />)
      await userEvent.click(screen.getByLabelText('Option A'))
      expect(onChange).toHaveBeenCalledWith('qa-1', ['Option A'])
    })

    it('calls onChange without the item when toggled off', async () => {
      const onChange = vi.fn()
      render(<QuestionInput question={question} answer={makeAnswer({ answer: ['Option A', 'Option B'] })} onChange={onChange} />)
      await userEvent.click(screen.getByLabelText('Option A'))
      expect(onChange).toHaveBeenCalledWith('qa-1', ['Option B'])
    })
  })

  describe('RATING type', () => {
    it('renders a range slider', () => {
      render(<QuestionInput question={makeQuestion({ answerType: 'RATING', value: { min: 1, max: 10 } })} answer={makeAnswer({ answer: 5 })} onChange={vi.fn()} />)
      expect(screen.getByRole('slider')).toBeInTheDocument()
      expect(screen.getByRole('slider')).toHaveValue('5')
    })

    it('calls onChange with a number on slider change', () => {
      const onChange = vi.fn()
      render(<QuestionInput question={makeQuestion({ answerType: 'RATING', value: { min: 1, max: 10 } })} answer={makeAnswer({ answer: 1 })} onChange={onChange} />)
      const slider = screen.getByRole('slider')
      // fireEvent.change is required for range inputs — userEvent doesn't fire the input event
      fireEvent.change(slider, { target: { value: '7' } })
      expect(onChange).toHaveBeenCalledWith('qa-1', 7)
    })
  })

  describe('DATE type', () => {
    it('renders a date input', () => {
      render(<QuestionInput question={makeQuestion({ answerType: 'DATE' })} answer={makeAnswer({ answer: '2026-06-22' })} onChange={vi.fn()} />)
      const input = screen.getByDisplayValue('2026-06-22')
      expect(input).toHaveAttribute('type', 'date')
    })
  })
})
