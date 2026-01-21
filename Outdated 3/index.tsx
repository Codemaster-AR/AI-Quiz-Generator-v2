
import { GoogleGenAI, Type } from "@google/genai";

// --- CONFIG & STATE ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let currentQuiz = null;
let userAnswers = {};
let inputMode = 'text';
let currentDifficulty = 'Medium';
let negativeMarking = false;
let extractedPdfText = "";

// --- DOM REFERENCES ---
const get = (id) => document.getElementById(id);
const views = {
    setup: get('setup-view'),
    loading: get('loading-view'),
    quiz: get('quiz-view'),
    results: get('results-view')
};

// --- CORE LOGIC ---
async function generateQuiz(text, count, difficulty) {
    const prompt = `Generate a JSON quiz with exactly ${count} multiple-choice questions from this text. 
    Difficulty: ${difficulty}. 
    Text: ${text.substring(0, 40000)}
    
    Response MUST be a single JSON object:
    { "questions": [ { "q": "question text", "o": ["opt1", "opt2", "opt3", "opt4"], "a": "correct option string" } ] }`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                q: { type: Type.STRING },
                                o: { type: Type.ARRAY, items: { type: Type.STRING } },
                                a: { type: Type.STRING }
                            },
                            required: ["q", "o", "a"]
                        }
                    }
                },
                required: ["questions"]
            }
        }
    });

    return JSON.parse(response.text.trim());
}

async function handlePdf(file) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + "\n";
    }
    return text;
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    window.scrollTo(0,0);
}

function renderQuiz() {
    const container = get('questions-container');
    container.innerHTML = '';
    userAnswers = {};
    get('quiz-meta').textContent = `${currentQuiz.questions.length} Questions • ${currentDifficulty}`;
    
    currentQuiz.questions.forEach((q, i) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800/50 border border-slate-700 rounded-3xl p-8 shadow-xl fade-in';
        card.style.animationDelay = `${i * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex items-start gap-4 mb-6">
                <span class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-lg flex-shrink-0">${i+1}</span>
                <p class="text-xl md:text-2xl font-bold text-slate-100">${q.q}</p>
            </div>
            <div class="grid gap-3" id="q-opts-${i}"></div>
        `;
        
        const optsDiv = card.querySelector(`#q-opts-${i}`);
        q.o.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left p-5 rounded-2xl border-2 border-slate-700 bg-slate-900/30 hover:border-indigo-500/50 transition-all font-medium text-slate-300';
            btn.textContent = opt;
            btn.onclick = () => {
                optsDiv.querySelectorAll('button').forEach(b => b.className = 'w-full text-left p-5 rounded-2xl border-2 border-slate-700 bg-slate-900/30 hover:border-indigo-500/50 transition-all font-medium text-slate-300');
                btn.className = 'w-full text-left p-5 rounded-2xl border-2 border-indigo-500 bg-indigo-600/20 text-indigo-300 font-bold';
                userAnswers[i] = opt;
            };
            optsDiv.appendChild(btn);
        });
        container.appendChild(card);
    });
}

// --- EVENT LISTENERS ---

// Toggle Context Mode
get('tab-text').onclick = () => {
    inputMode = 'text';
    get('text-section').classList.remove('hidden');
    get('pdf-section').classList.add('hidden');
    get('tab-text').className = 'flex-1 py-4 rounded-[30px] font-bold bg-indigo-600 text-white shadow-lg';
    get('tab-pdf').className = 'flex-1 py-4 rounded-[30px] font-bold text-slate-500 hover:text-slate-300';
};

get('tab-pdf').onclick = () => {
    inputMode = 'pdf';
    get('text-section').classList.add('hidden');
    get('pdf-section').classList.remove('hidden');
    get('tab-pdf').className = 'flex-1 py-4 rounded-[30px] font-bold bg-indigo-600 text-white shadow-lg';
    get('tab-text').className = 'flex-1 py-4 rounded-[30px] font-bold text-slate-500 hover:text-slate-300';
};

// Settings
// Fix: Cast e.target to HTMLInputElement to access .value property
get('count-range').oninput = (e) => get('count-label').textContent = (e.target as HTMLInputElement).value;

document.querySelectorAll('#diff-selector button').forEach(el => {
    // Fix: Cast element to HTMLButtonElement to access .onclick property
    const btn = el as HTMLButtonElement;
    btn.onclick = () => {
        document.querySelectorAll('#diff-selector button').forEach(b => {
            b.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
            b.classList.add('text-slate-500');
        });
        btn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.remove('text-slate-500');
        // Fix: Casting el to HTMLButtonElement (above) provides access to .dataset property
        currentDifficulty = btn.dataset.diff || 'Medium';
    };
});

get('toggle-negative').onclick = () => {
    negativeMarking = !negativeMarking;
    get('negative-knob').style.transform = negativeMarking ? 'translateX(24px)' : 'translateX(0)';
    get('toggle-negative').style.backgroundColor = negativeMarking ? '#6366f1' : '#334155';
};

// PDF Handler
get('pdf-file').onchange = async (e) => {
    // Fix: Cast e.target to HTMLInputElement to access .files property
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        get('pdf-name').textContent = `Extracting ${file.name}...`;
        extractedPdfText = await handlePdf(file);
        get('pdf-name').textContent = file.name;
    }
};

// Actions
get('generate-btn').onclick = async () => {
    const errorBox = get('error-msg');
    errorBox.classList.add('hidden');
    
    // Fix: Cast to HTMLTextAreaElement to access .value property
    const source = inputMode === 'text' ? (get('context-input') as HTMLTextAreaElement).value : extractedPdfText;
    if (source.trim().length < 50) {
        errorBox.textContent = "Please provide more context (at least 50 chars).";
        errorBox.classList.remove('hidden');
        return;
    }

    switchView('loading');
    try {
        // Fix: Cast to HTMLInputElement to access .value property
        currentQuiz = await generateQuiz(source, (get('count-range') as HTMLInputElement).value, currentDifficulty);
        renderQuiz();
        switchView('quiz');
    } catch (err) {
        errorBox.textContent = "API Error: " + (err instanceof Error ? err.message : String(err));
        errorBox.classList.remove('hidden');
        switchView('setup');
    }
};

get('submit-quiz').onclick = () => {
    let correct = 0;
    let wrong = 0;
    currentQuiz.questions.forEach((q, i) => {
        if (userAnswers[i] === q.a) correct++;
        else if (userAnswers[i]) wrong++;
    });

    const score = negativeMarking ? (correct - (wrong * 0.25)) : correct;
    get('score-val').textContent = score.toFixed(1);
    // Fix: Convert number to string to assign to textContent
    get('correct-val').textContent = String(correct);
    switchView('results');
};

get('cancel-quiz').onclick = () => switchView('setup');
get('restart-btn').onclick = () => switchView('setup');
