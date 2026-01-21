import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// --- Configuration ---
const GROQ_API_KEY = "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";
const MAX_QUESTIONS = 500;

// --- Types ---
interface Question {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

interface Quiz {
  questions: Question[];
}

type InputMode = 'text' | 'pdf';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

// --- Icons ---
const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

// --- Groq Service ---
const generateQuizWithLlama = async (text: string, numQuestions: number, difficulty: Difficulty, filter: string): Promise<Quiz> => {
  const prompt = `Generate a JSON quiz with exactly ${numQuestions} multiple-choice questions based on the provided text.
  
  Difficulty Level: ${difficulty}
  Focus/Filter: ${filter || "General key concepts and details"}
  
  Context Text:
  ${text.substring(0, 40000)}

  JSON Schema Requirements:
  {
    "questions": [
      {
        "questionText": "string",
        "options": ["option1", "option2", "option3", "option4"],
        "correctAnswer": "the exact string of the correct option"
      }
    ]
  }

  Rules:
  1. Return ONLY the raw JSON object. No preamble or chat.
  2. Each question must have 4 options.
  3. Ensure the correctAnswer is present in the options list.
  4. Maximize quality and factual accuracy.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 8192 // Limit of current Llama 3 models on Groq
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Groq API error');
    }

    const data = await response.json();
    const quizData = JSON.parse(data.choices[0].message.content) as Quiz;
    
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid JSON structure returned from AI.');
    }

    return quizData;
  } catch (err: any) {
    console.error("Quiz Generation Failed:", err);
    throw new Error(`Generation failed: ${err.message}`);
  }
};

// --- PDF Processor Logic ---
declare var pdfjsLib: any;
const extractTextFromPdf = async (file: File): Promise<string> => {
  if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js library is not loaded.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
  }
  return fullText;
};

// --- Main App Component ---
const App = () => {
  const [mode, setMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [filter, setFilter] = useState('');
  const [negativeMarking, setNegativeMarking] = useState(false);
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let contextText = inputText;
      if (mode === 'pdf') {
        if (!selectedFile) throw new Error('Please upload a PDF.');
        contextText = await extractTextFromPdf(selectedFile);
      } else if (inputText.length < 50) {
        throw new Error('Please enter at least 50 characters for context.');
      }

      const generatedQuiz = await generateQuizWithLlama(contextText, numQuestions, difficulty, filter);
      setQuiz(generatedQuiz);
      setUserAnswers({});
      setShowResults(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setQuiz(null);
    setShowResults(false);
    setUserAnswers({});
    setError(null);
  };

  const scoreData = useMemo(() => {
    if (!quiz || !showResults) return null;
    let correct = 0;
    let incorrect = 0;
    quiz.questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
      else if (userAnswers[i] !== undefined) incorrect++;
    });
    const finalScore = negativeMarking ? (correct - (incorrect * 0.25)) : correct;
    return { correct, incorrect, finalScore, total: quiz.questions.length };
  }, [quiz, showResults, userAnswers, negativeMarking]);

  // Render Quiz Interface
  if (quiz) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-10 flex items-center justify-between border-b border-slate-700 pb-6">
          <div>
            <h2 className="text-4xl font-black text-indigo-400">Quiz Active</h2>
            <p className="text-slate-400 font-medium">{quiz.questions.length} Questions • {difficulty} Difficulty</p>
          </div>
          <button onClick={reset} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all font-bold">
            Cancel
          </button>
        </header>

        <div className="space-y-8 pb-24">
          {quiz.questions.map((q, qIndex) => (
            <div key={qIndex} className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative">
              <div className="flex items-start gap-4 mb-8">
                <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-lg">
                  {qIndex + 1}
                </span>
                <p className="text-2xl font-bold leading-tight text-slate-100">{q.questionText}</p>
              </div>

              <div className="grid gap-3">
                {q.options.map((opt, oIndex) => {
                  const isSelected = userAnswers[qIndex] === opt;
                  const isCorrect = q.correctAnswer === opt;
                  let style = "flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-200 text-left w-full text-lg font-medium ";
                  
                  if (showResults) {
                    if (isCorrect) style += "bg-green-500/10 border-green-500/50 text-green-300";
                    else if (isSelected) style += "bg-red-500/10 border-red-500/50 text-red-300";
                    else style += "bg-slate-900/50 border-slate-800 text-slate-500 opacity-60";
                  } else {
                    style += isSelected 
                      ? "bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-500/30 -translate-y-1" 
                      : "bg-slate-900/50 border-slate-700 text-slate-300 hover:border-indigo-500 hover:bg-slate-700/50";
                  }

                  return (
                    <button
                      key={oIndex}
                      onClick={() => !showResults && setUserAnswers(p => ({ ...p, [qIndex]: opt }))}
                      disabled={showResults}
                      className={style}
                    >
                      <span>{opt}</span>
                      {showResults && isCorrect && <CheckIcon className="w-6 h-6 text-green-400" />}
                      {showResults && isSelected && !isCorrect && <XIcon className="w-6 h-6 text-red-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-8 left-0 right-0 px-4 flex justify-center">
          {!showResults ? (
            <button
              onClick={() => setShowResults(true)}
              className="w-full max-w-lg py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xl rounded-2xl shadow-2xl transition-all transform hover:scale-[1.02] active:scale-95 border-t border-white/20"
            >
              Submit Results
            </button>
          ) : (
            <div className="bg-slate-800/90 backdrop-blur-xl border border-indigo-500/50 p-6 rounded-3xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-8 duration-500">
               <div className="text-center">
                  <p className="text-3xl font-black text-indigo-400">{scoreData?.finalScore.toFixed(1)}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Score</p>
               </div>
               <div className="h-10 w-[1px] bg-slate-700"></div>
               <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{scoreData?.correct}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Correct</p>
               </div>
               <button onClick={reset} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all">
                  New Quiz
               </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Settings/Input Interface
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 overflow-x-hidden">
      <div className="w-full max-w-4xl relative">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-[120px]"></div>

        <header className="text-center mb-12 relative">
          <h1 className="text-6xl font-black mb-4 tracking-tighter">
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Llama 3 Quiz Pro
            </span>
          </h1>
          <p className="text-slate-400 text-xl font-medium">Generate up to 500 questions instantly via Groq</p>
        </header>

        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-[40px] shadow-2xl overflow-hidden relative">
          <div className="flex bg-slate-900/80 p-2">
            <button
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[30px] transition-all font-bold ${mode === 'text' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <DocumentTextIcon className="w-5 h-5" /> Context Text
            </button>
            <button
              onClick={() => setMode('pdf')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[30px] transition-all font-bold ${mode === 'pdf' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <UploadIcon className="w-5 h-5" /> PDF Document
            </button>
          </div>

          <div className="p-10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="text-center">
                   <p className="text-2xl font-bold text-slate-200">Generating Questions...</p>
                   <p className="text-slate-500 mt-2">Llama 3 is analyzing your content...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {mode === 'text' ? (
                  <textarea
                    className="w-full h-64 bg-slate-900/50 border border-slate-700 rounded-3xl p-6 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-600 text-lg custom-scrollbar resize-none"
                    placeholder="Paste context here (Articles, Notes, Books)..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                ) : (
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-4 border-dashed border-slate-700 rounded-3xl p-16 flex flex-col items-center justify-center bg-slate-900/30 group-hover:bg-slate-800/40 group-hover:border-indigo-500/50 transition-all">
                      <UploadIcon className="w-16 h-16 text-slate-500 group-hover:text-indigo-400 mb-4 transition-all" />
                      <p className="text-xl font-bold text-slate-300">{selectedFile ? selectedFile.name : 'Drop your PDF here'}</p>
                      <p className="text-slate-500 text-sm mt-2">Maximum file size 50MB</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Quiz Quantity</label>
                    <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-700 flex items-center justify-between">
                       <input 
                         type="range" min="1" max={MAX_QUESTIONS} step="1" 
                         value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))}
                         className="flex-1 accent-indigo-500 mr-4"
                       />
                       <span className="bg-indigo-600 px-4 py-2 rounded-xl font-black text-xl min-w-[70px] text-center">{numQuestions}</span>
                    </div>
                    {numQuestions > 100 && (
                      <p className="text-[10px] text-amber-500 font-bold px-2">Note: High question counts may hit AI output limits.</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Difficulty</label>
                    <div className="flex bg-slate-900/50 p-2 rounded-3xl border border-slate-700">
                      {['Easy', 'Medium', 'Hard', 'Mixed'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d as Difficulty)}
                          className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${difficulty === d ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">Custom Focus</label>
                    <input
                      type="text"
                      placeholder="e.g. Focus on dates, names, or specific chapters..."
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-3xl p-4 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-600"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>

                  <div className="space-y-4 flex flex-col justify-end">
                    <button
                      onClick={() => setNegativeMarking(!negativeMarking)}
                      className={`w-full flex items-center justify-between p-4 rounded-3xl border-2 transition-all font-bold ${negativeMarking ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-slate-900/50 border-slate-700 text-slate-500'}`}
                    >
                      <span>Negative Marking (0.25)</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${negativeMarking ? 'bg-red-500 border-red-500' : 'border-slate-600'}`}>
                        {negativeMarking && <CheckIcon className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-5 bg-red-900/20 border-2 border-red-500/50 text-red-300 rounded-3xl flex items-center gap-4 animate-in shake duration-500">
                    <XIcon className="w-6 h-6 flex-shrink-0" />
                    <p className="font-bold">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  className="w-full py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-white font-black text-2xl rounded-[30px] shadow-2xl transition-all transform hover:scale-[1.01] active:scale-95 border-t border-white/20"
                >
                  Generate {numQuestions} Questions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Render entry
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);