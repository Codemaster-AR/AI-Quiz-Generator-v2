import React, { useState, useCallback, useMemo } from 'react';
import { usePdfProcessor } from '../hooks/usePdfProcessor';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import DocumentTextIcon from './icons/DocumentTextIcon';
import UploadIcon from './icons/UploadIcon';

type InputMode = 'text' | 'pdf';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

interface QuizInputProps {
  onGenerate: (sourceText: string, numQuestions: number, difficulty: Difficulty, filter: string, negativeMarking: boolean) => void;
  isGenerating: boolean;
}

const QuizInput: React.FC<QuizInputProps> = ({ onGenerate, isGenerating }) => {
  const [mode, setMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [filter, setFilter] = useState<string>('');
  const [negativeMarking, setNegativeMarking] = useState<boolean>(false);
  const { processPdf, isProcessing: isPdfProcessing, error: pdfError } = usePdfProcessor();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setLocalError('Please upload a PDF file.');
        setFile(null);
      } else {
        setLocalError(null);
        setFile(selectedFile);
      }
    }
  };

  const handleSubmit = useCallback(async () => {
    setLocalError(null);
     if (numQuestions < 1 || numQuestions > 500) {
      setLocalError('Please enter a number of questions between 1 and 500.');
      return;
    }
    if (mode === 'text') {
      if (text.trim().length < 100) {
        setLocalError('Please enter at least 100 characters of text.');
        return;
      }
      onGenerate(text, numQuestions, difficulty, filter, negativeMarking);
    } else if (mode === 'pdf') {
      if (!file) {
        setLocalError('Please select a PDF file.');
        return;
      }
      const pdfText = await processPdf(file);
      if (pdfText) {
        onGenerate(pdfText, numQuestions, difficulty, filter, negativeMarking);
      }
    }
  }, [mode, text, file, onGenerate, processPdf, numQuestions, difficulty, filter, negativeMarking]);

  const isButtonDisabled = useMemo(() => {
    if (isGenerating || isPdfProcessing) return true;
    if (numQuestions < 1 || numQuestions > 500) return true;
    if (mode === 'text' && text.trim().length < 100) return true;
    if (mode === 'pdf' && !file) return true;
    return false;
  }, [isGenerating, isPdfProcessing, mode, text, file, numQuestions]);

  const isLoading = isGenerating || isPdfProcessing;
  const loadingMessage = isPdfProcessing ? 'Processing PDF...' : 'Generating Quiz...';

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex border-b border-slate-700">
        <TabButton title="Text Input" icon={<DocumentTextIcon className="w-5 h-5 mr-2" />} active={mode === 'text'} onClick={() => setMode('text')} />
        <TabButton title="PDF Upload" icon={<UploadIcon className="w-5 h-5 mr-2" />} active={mode === 'pdf'} onClick={() => setMode('pdf')} />
      </div>

      <div className="p-6">
        {isLoading ? (
          <Loader message={loadingMessage} />
        ) : (
          <>
            {mode === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here to generate a quiz (minimum 100 characters)..."
                className="w-full h-48 p-3 bg-slate-900 border border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-none"
                aria-label="Text input for quiz generation"
              />
            )}
            {mode === 'pdf' && (
              <div className="flex flex-col items-center justify-center w-full">
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-900 hover:bg-slate-700/50 transition duration-200">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadIcon className="w-10 h-10 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-400">
                      <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">PDF only</p>
                  </div>
                  <input id="file-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>
                {file && <p className="mt-2 text-sm text-slate-300">Selected: {file.name}</p>}
              </div>
            )}
            
            <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label htmlFor="num-questions" className="block text-sm font-medium text-slate-300 mb-2">
                          Number of Questions
                      </label>
                      <input
                          id="num-questions"
                          type="number"
                          value={numQuestions}
                          onChange={(e) => {
                              const num = e.target.valueAsNumber;
                              if (isNaN(num)) {
                                  setNumQuestions(1);
                              } else {
                                  setNumQuestions(Math.floor(Math.max(1, Math.min(500, num))));
                              }
                          }}
                          min="1"
                          max="500"
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                          aria-describedby="num-questions-description"
                      />
                      <p id="num-questions-description" className="text-xs text-slate-500 mt-1">Enter a number between 1 and 500.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md bg-slate-900 p-1">
                      {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map((level) => (
                        <DifficultyButton
                          key={level}
                          level={level}
                          isActive={difficulty === level}
                          onClick={() => setDifficulty(level)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                    <label htmlFor="filter-focus" className="block text-sm font-medium text-slate-300 mb-2">
                        Filter Focus (Optional)
                    </label>
                    <input
                        id="filter-focus"
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="e.g., dates, key figures, technical specifications"
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                        aria-describedby="filter-focus-description"
                    />
                    <p id="filter-focus-description" className="text-xs text-slate-500 mt-1">Describe a specific topic to focus the questions on.</p>
                </div>

                <div>
                  <label htmlFor="negative-marking" className="flex items-center justify-between cursor-pointer p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <span className="block text-sm font-medium text-slate-300">
                        Negative Marking
                        <span className="block text-xs text-slate-500 mt-1">Incorrect answers will subtract points.</span>
                    </span>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        id="negative-marking" 
                        className="sr-only peer" 
                        checked={negativeMarking}
                        onChange={() => setNegativeMarking(!negativeMarking)} 
                      />
                      <div className="block bg-slate-700 w-14 h-8 rounded-full peer-checked:bg-indigo-600 transition"></div>
                      <div className="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                    </div>
                  </label>
                </div>
            </div>

            {(localError || pdfError) && <ErrorMessage message={localError || pdfError!} />}
            
            <button
              onClick={handleSubmit}
              disabled={isButtonDisabled}
              className="w-full mt-6 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:scale-100"
            >
              Generate Quiz
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface TabButtonProps {
    title: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ title, icon, active, onClick}) => (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center py-3 px-4 font-semibold transition duration-200 focus:outline-none ${active ? 'bg-slate-800 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800/50'}`}>
        {icon}
        {title}
    </button>
);

interface DifficultyButtonProps {
  level: Difficulty;
  isActive: boolean;
  onClick: () => void;
}

const DifficultyButton: React.FC<DifficultyButtonProps> = ({ level, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-center text-sm font-semibold p-2 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 ${
      isActive
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`}
  >
    {level}
  </button>
);


export default QuizInput;