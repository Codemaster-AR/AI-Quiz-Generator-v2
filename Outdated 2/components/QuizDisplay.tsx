import React, { useState, useMemo } from 'react';
import type { Quiz, Question } from '../types';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';

interface QuizDisplayProps {
  quiz: Quiz;
  onReset: () => void;
  negativeMarking: boolean;
}

const ConfirmationModal = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
    <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
      <h3 className="text-lg font-bold text-white mb-2">Submit Quiz?</h3>
      <p className="text-slate-400 mb-6">You have unanswered questions. Are you sure you want to submit and see your score?</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-md bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          Submit
        </button>
      </div>
    </div>
  </div>
);

const QuizDisplay: React.FC<QuizDisplayProps> = ({ quiz, onReset, negativeMarking }) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const handleAnswerSelect = (questionIndex: number, option: string) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionIndex]: option }));
  };
  
  const handleSubmitClick = () => {
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < quiz.questions.length) {
      setIsConfirmModalOpen(true);
    } else {
      setShowResults(true);
    }
  };

  const handleConfirmSubmit = () => {
    setShowResults(true);
    setIsConfirmModalOpen(false);
  };
  
  const { score, correctCount, incorrectCount, unansweredCount } = useMemo(() => {
    if (!showResults) return { score: 0, correctCount: 0, incorrectCount: 0, unansweredCount: quiz.questions.length };
    
    let correct = 0;
    let incorrect = 0;
    
    quiz.questions.forEach((_question, index) => {
      const userAnswer = userAnswers[index];
      if (userAnswer === undefined) {
        // unanswered
      } else if (userAnswer === quiz.questions[index].correctAnswer) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const finalScore = negativeMarking ? correct - incorrect : correct;
    const unanswered = quiz.questions.length - correct - incorrect;

    return { score: finalScore, correctCount: correct, incorrectCount: incorrect, unansweredCount: unanswered };
  }, [showResults, userAnswers, quiz.questions, negativeMarking]);


  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8">
      {isConfirmModalOpen && <ConfirmationModal onConfirm={handleConfirmSubmit} onCancel={() => setIsConfirmModalOpen(false)} />}
      <h2 className="text-3xl font-bold text-center text-indigo-400 mb-6">Your Quiz</h2>

      {quiz.questions.map((q, index) => (
        <QuestionCard
          key={index}
          question={q}
          questionIndex={index}
          userAnswer={userAnswers[index]}
          onAnswerSelect={handleAnswerSelect}
          showResult={showResults}
        />
      ))}

      {!showResults ? (
        <button
          onClick={handleSubmitClick}
          className="w-full mt-6 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all duration-300"
        >
          Check Answers
        </button>
      ) : (
        <div className="mt-8 text-center p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-2xl font-bold">Quiz Complete!</h3>
          <p className="text-slate-300 mt-2 mb-4">Here's how you did:</p>
          <div className="flex justify-center items-end gap-2 my-4">
            <span className="text-6xl font-extrabold text-indigo-400">{score}</span>
            <span className="text-2xl font-bold text-slate-400">/ {quiz.questions.length}</span>
          </div>
          <p className="text-lg text-slate-300 font-bold">Final Score</p>
          
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-green-900/50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">{correctCount}</p>
                  <p className="text-sm text-slate-300">Correct</p>
              </div>
              <div className="bg-red-900/50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-400">{incorrectCount}</p>
                  <p className="text-sm text-slate-300">Incorrect</p>
              </div>
              <div className="bg-slate-700/50 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-slate-400">{unansweredCount}</p>
                  <p className="text-sm text-slate-300">Unanswered</p>
              </div>
          </div>

          <button
            onClick={onReset}
            className="w-full md:w-auto mt-8 py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all duration-300"
          >
            Create Another Quiz
          </button>
        </div>
      )}
    </div>
  );
};

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  userAnswer?: string;
  onAnswerSelect: (questionIndex: number, option: string) => void;
  showResult: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, questionIndex, userAnswer, onAnswerSelect, showResult }) => {
  return (
    <div className="mb-6 p-5 bg-slate-900 rounded-lg border border-slate-700">
      <p className="font-semibold text-lg text-slate-200 mb-4">{questionIndex + 1}. {question.questionText}</p>
      <div className="space-y-2">
        {question.options.map((option, i) => {
          const isSelected = userAnswer === option;
          const isCorrect = question.correctAnswer === option;
          let buttonClass = 'w-full text-left p-3 rounded-md transition-colors duration-200 border border-slate-600 bg-slate-800 hover:bg-slate-700';

          if (showResult) {
            if (isCorrect) {
              buttonClass = 'w-full text-left p-3 rounded-md border border-green-700 bg-green-900/50 text-white';
            } else if (isSelected && !isCorrect) {
              buttonClass = 'w-full text-left p-3 rounded-md border border-red-700 bg-red-900/50 text-white';
            } else {
               buttonClass = 'w-full text-left p-3 rounded-md border border-slate-700 bg-slate-800 text-slate-400';
            }
          } else if (isSelected) {
            buttonClass += ' bg-indigo-900/70 border-indigo-500 ring-2 ring-indigo-500';
          }
          
          return (
            <button key={i} onClick={() => onAnswerSelect(questionIndex, option)} className={buttonClass} disabled={showResult}>
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {showResult && isCorrect && <CheckIcon className="w-6 h-6 text-green-400" />}
                {showResult && isSelected && !isCorrect && <XIcon className="w-6 h-6 text-red-400" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuizDisplay;