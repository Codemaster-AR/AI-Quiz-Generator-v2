import React, { useState, useCallback } from 'react';
import QuizInput from './components/QuizInput';
import QuizDisplay from './components/QuizDisplay';
import { generateQuizFromText } from './services/geminiService';
import ErrorMessage from './components/ErrorMessage';
import type { Quiz, Question } from './types';

// Shuffles the array in place using the Fisher-Yates algorithm
const shuffleArray = (array: Question[]): Question[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};


function App() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState({ negativeMarking: false });

  const handleGenerateQuiz = useCallback(async (sourceText: string, numQuestions: number, difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed', filter: string, negativeMarking: boolean) => {
    setIsLoading(true);
    setError(null);
    setQuiz(null);
    setQuizSettings({ negativeMarking });
    try {
      const generatedQuiz = await generateQuizFromText(sourceText, numQuestions, difficulty, filter);
      if (generatedQuiz && generatedQuiz.questions) {
        generatedQuiz.questions = shuffleArray(generatedQuiz.questions);
      }
      setQuiz(generatedQuiz);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleReset = () => {
    setQuiz(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
          AI Quiz Generator
        </h1>
        <p className="mt-2 text-lg text-slate-400">
          Create quizzes from text or PDFs in seconds.
        </p>
      </header>
      <main className="w-full">
        {!quiz && (
          <>
            {error && <div className="max-w-2xl mx-auto"><ErrorMessage message={error} /></div>}
            <QuizInput onGenerate={handleGenerateQuiz} isGenerating={isLoading} />
          </>
        )}
        {quiz && !error && <QuizDisplay quiz={quiz} onReset={handleReset} negativeMarking={quizSettings.negativeMarking} />}
      </main>
       <footer className="text-center mt-8 text-slate-500 text-sm">
        <p>Powered by Google Gemini</p>
      </footer>
    </div>
  );
}

export default App;